const { getConfig } = require('../Utility/config');
const { CATEGORIES } = require('../Utility/errorMessages');

const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434';

const classifyHttpError = (status, errBody) => {
    const detail = (errBody && errBody.slice(0, 200)) || `HTTP ${status}`;
    if (status === 404) return { category: CATEGORIES.MODEL_NOT_FOUND, detail };
    if (status === 400 && /model.*(not found|not loaded)/i.test(errBody || '')) {
        return { category: CATEGORIES.MODEL_NOT_FOUND, detail };
    }
    if (status >= 500) return { category: CATEGORIES.UPSTREAM, detail };
    return { category: CATEGORIES.UNKNOWN, detail };
};

/**
 * Chat with tool support via local Ollama REST API.
 */
const chat = async (model, systemInstruction, tools, messages) => {
    const host = getConfig()?.OLLAMA_URL || DEFAULT_OLLAMA_HOST;
    const formatMessage = (msg) => {
        if (msg.role === 'tool') {
            // Convert tool results to user messages for Ollama compatibility
            const out = { role: 'user', content: `[Tool Result: ${msg.name || 'unknown'}]\n${msg.content || ''}` };
            if (msg.images?.length > 0) out.images = msg.images.map(img => img.data);
            return out;
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
                if (m.images?.length > 0) {
                    merged[merged.length - 1].images = [...(merged[merged.length - 1].images || []), ...m.images];
                }
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
    let doneReason = null;

    try {
        const response = await fetch(`${host}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errBody = await response.text();
            result.error = classifyHttpError(response.status, errBody);
            return result;
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

                    if (chunk.done_reason) doneReason = chunk.done_reason;
                } catch (e) {
                    buffer = line + '\n' + buffer;
                }
            }
        }

        if (doneReason === 'length') {
            result.error = { category: CATEGORIES.TRUNCATED, detail: 'done_reason: length' };
        }
    } catch (error) {
        result.error = { category: CATEGORIES.NETWORK, detail: error.message };
    }

    return result;
};

/**
 * Simple text completion via local Ollama.
 */
const complete = async (model, prompt, systemPrompt) => {
    const host = getConfig()?.OLLAMA_URL || DEFAULT_OLLAMA_HOST;
    try {
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });

        const response = await fetch(`${host}/api/chat`, {
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
