const { getConfig } = require('../Utility/config');
const OLLAMA_HOST = getConfig()?.OLLAMA_URL || 'http://127.0.0.1:11434';


/**
 * Chat with tool support via local Ollama REST API.
 */
const chat = async (model, systemInstruction, tools, messages) => {
    const formatMessage = (msg) => {
        if (msg.role === 'tool') {
            // Convert tool results to user messages for Ollama compatibility
            return { role: 'user', content: `[Tool Result: ${msg.name || 'unknown'}]\n${msg.content || ''}` };
        }
        if (msg.role === 'assistant') {
            return { role: 'assistant', content: msg.content || '' };
        }
        const out = { role: 'user', content: msg.content || '' };
        if (msg.images?.length > 0) out.images = msg.images.map(img => img.data);
        return out;
    };

    // Keep assistant turn structure intact for Ollama (user→assistant→user).
    // Empty assistant messages (tool-call-only) get a placeholder instead of being removed.
    // Consecutive same-role messages get merged (e.g. user + tool-as-user back-to-back).
    const formatAndFilter = (msgs) => {
        const formatted = msgs.map(formatMessage).filter(m => m.role === 'assistant' || m.content.trim() !== '');
        for (const m of formatted) {
            if (m.role === 'assistant' && !m.content.trim()) {
                m.content = '(calling tool)';
            }
        }
        const merged = [];
        for (const m of formatted) {
            if (merged.length > 0 && merged[merged.length - 1].role === m.role) {
                merged[merged.length - 1].content += '\n\n' + m.content;
            } else {
                merged.push({ ...m });
            }
        }
        return merged;
    };

    messages = [
        { role: 'system', content: systemInstruction },
        ...formatAndFilter(messages)
    ];

    const payload = { model, messages, stream: true };
    if (tools?.length > 0) payload.tools = tools;

    const result = { role: 'assistant', content: '', tool_calls: [] };

    try {
        const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errBody}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const chunk = JSON.parse(line);
                    if (chunk.message?.content) {
                        result.content += chunk.message.content;
                    }

                    if (chunk.message?.tool_calls?.length > 0) {
                        for (const tc of chunk.message.tool_calls) {
                            result.tool_calls.push({
                                function: { name: tc.function.name, arguments: tc.function.arguments }
                            });
                        }
                    }
                } catch (e) {
                    buffer = line + '\n' + buffer;
                }
            }
        }
    } catch (error) {
        console.error('[OllamaProvider] Fetch error:', error);
    }

    return result;
};

/**
 * Simple text completion via local Ollama.
 */
const complete = async (model, prompt, systemPrompt) => {
    try {
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });

        const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        const json = await response.json();
        return json.message?.content?.trim() || '';
    } catch (error) {
        console.error('[OllamaProvider] Complete fetch error:', error);
        return '';
    }
};

module.exports = { chat, complete };
