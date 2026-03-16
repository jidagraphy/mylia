const { getConfig } = require('../Utility/config');
const OLLAMA_HOST = getConfig()?.OLLAMA_URL || 'http://127.0.0.1:11434';


/**
 * Chat with tool support via local Ollama REST API.
 */
const chat = async (model, history, systemInstruction, tools, currentMessage) => {
    const formatMessage = (msg) => {
        if (msg.role === 'tool') {
            // Convert tool results to user messages for Gemini compatibility
            // Gemini proxy requires paired tool_calls + results with thought_signature, 
            // which we can't produce. Flattening to user messages works universally.
            return { role: 'user', content: `[Tool Result: ${msg.name || 'unknown'}]\n${msg.content || ''}` };
        }
        if (msg.role === 'assistant') {
            return { role: 'assistant', content: msg.content || '' };
        }
        return { role: 'user', content: msg.content || '' };
    };

    // Filter out empty assistant messages (tool-call-only responses that have no text)
    const formatAndFilter = (msgs) => {
        const formatted = msgs.map(formatMessage).filter(m => m.content.trim() !== '');
        // Merge consecutive same-role messages (e.g. user + tool-as-user back-to-back)
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

    const messages = [
        { role: 'system', content: systemInstruction },
        ...formatAndFilter(history),
        formatMessage(currentMessage)
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

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkString = decoder.decode(value, { stream: true });
            const lines = chunkString.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                try {
                    const chunk = JSON.parse(line);
                    if (chunk.message?.content) {
                        result.content += chunk.message.content;
                    }

                    if (chunk.message?.tool_calls?.length > 0) {
                        result.tool_calls = chunk.message.tool_calls.map(tc => ({
                            function: { name: tc.function.name, arguments: tc.function.arguments }
                        }));
                    }
                } catch (e) {
                    // Ignore incomplete JSON chunks, they will be handled by stream buffering
                    console.error('[OllamaProvider] Failed to parse stream chunk:', e.message);
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
const complete = async (model, prompt) => {
    try {
        const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
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
