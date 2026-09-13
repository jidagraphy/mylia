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
    // Native tool format: assistant messages keep real tool_calls, results go back as role "tool".
    // Never flatten tool calls into text — the model imitates whatever tool-call shape it sees in history
    // (the old "(calling tool)" placeholder got copied verbatim as fake tool calls).
    const parseArgs = (args) => {
        if (typeof args !== 'string') return args || {};
        try { return JSON.parse(args); } catch { return {}; }
    };
    const withImages = (out, msg) => {
        if (msg.images?.length > 0) out.images = msg.images.map(img => img.data);
        return out;
    };
    const formatMessage = (msg) => {
        if (msg.role === 'tool') {
            return withImages({ role: 'tool', tool_name: msg.name || 'unknown', content: msg.content || '' }, msg);
        }
        if (msg.role === 'assistant') {
            const out = { role: 'assistant', content: msg.content || '' };
            if (msg.tool_calls?.length > 0) {
                out.tool_calls = msg.tool_calls.map(tc => ({ function: { name: tc.function.name, arguments: parseArgs(tc.function.arguments) } }));
            }
            return out;
        }
        return withImages({ role: 'user', content: msg.content || '' }, msg);
    };

    messages = [
        { role: 'system', content: systemInstruction },
        ...messages.map(formatMessage).filter(m => m.role !== 'user' || m.content.trim() || m.images),
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
