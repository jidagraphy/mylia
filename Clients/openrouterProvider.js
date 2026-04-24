const { getConfig } = require('../Utility/config');

/**
 * Chat with tool support via OpenRouter REST API (OpenAI format).
 */
const chat = async (model, systemInstruction, tools, messages) => {
    const apiKey = getConfig()?.OPENROUTER_API_KEY;
    const formatMessage = (msg) => {
        if (msg.role === 'tool') {
            const toolMsg = { role: 'tool', tool_call_id: msg.tool_call_id || 'unknown', content: msg.content || '', name: msg.name || 'unknown_tool' };
            if (msg.images?.length > 0) {
                // OpenAI format doesn't support images in tool results — return tool msg + user msg with image
                const parts = [{ type: 'text', text: '[Attached image from tool result]' }];
                for (const img of msg.images) {
                    parts.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.data}` } });
                }
                return [toolMsg, { role: 'user', content: parts }];
            }
            return toolMsg;
        }
        if (msg.role === 'assistant') {
            const out = { role: 'assistant', content: msg.content || '' };
            if (msg.tool_calls && msg.tool_calls.length > 0) {
                out.tool_calls = msg.tool_calls.map(tc => ({
                    id: tc.id || `call_${Math.random().toString(36).substr(2, 9)}`, // OpenRouter demands an ID
                    type: "function",
                    function: { name: tc.function.name, arguments: typeof tc.function.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function.arguments) }
                }));
            }
            return out;
        }
        if (msg.images?.length > 0) {
            const parts = [];
            if (msg.content) parts.push({ type: 'text', text: msg.content });
            for (const img of msg.images) {
                parts.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.data}` } });
            }
            return { role: 'user', content: parts };
        }
        return { role: 'user', content: msg.content || '' };
    };

    messages = [
        { role: 'system', content: systemInstruction },
        ...messages.map(formatMessage).flat()
    ];

    const payload = { model, messages, stream: true };
    if (tools?.length > 0) payload.tools = tools;

    const result = { role: 'assistant', content: '', tool_calls: [] };
    const toolCallsMap = {}; // Used to accumulate streamed tool arguments

    if (!apiKey) {
        console.error('[OpenRouterProvider] Missing OPENROUTER_API_KEY in config.json');
        return Object.assign(result, { content: 'System Error: OpenRouter API key is missing.' });
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/jidagraphy/mylia',
                'X-Title': 'Mylia Agent'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkString = decoder.decode(value, { stream: true });
            buffer += chunkString;
            
            const lines = buffer.split('\n');
            // Keep the last partial line in the buffer
            buffer = lines.pop() || '';

            for (let line of lines) {
                line = line.trim();
                if (!line || !line.startsWith('data: ')) continue;
                if (line === 'data: [DONE]') continue;

                try {
                    const chunk = JSON.parse(line.substring(6));
                    const delta = chunk.choices?.[0]?.delta;

                    if (delta?.content) {
                        result.content += delta.content;
                    }

                    if (delta?.tool_calls?.length > 0) {
                        for (const tc of delta.tool_calls) {
                            if (!toolCallsMap[tc.index]) {
                                toolCallsMap[tc.index] = { id: tc.id, name: '', arguments: '' };
                            }
                            if (tc.function?.name) toolCallsMap[tc.index].name += tc.function.name;
                            if (tc.function?.arguments) toolCallsMap[tc.index].arguments += tc.function.arguments;
                        }
                    }
                } catch (e) {
                    // If JSON parse fails, it might be an incomplete chunk that got split exactly at a newline.
                    // Put it back in the buffer to prepend to the next chunk.
                    buffer = line + '\n' + buffer;
                }
            }
        }

        // Finalize accumulated tool calls
        if (Object.keys(toolCallsMap).length > 0) {
            result.tool_calls = Object.values(toolCallsMap).map(fn => ({
                id: fn.id,
                function: { name: fn.name, arguments: fn.arguments }
            }));
        }

    } catch (error) {
        console.error('\n[OpenRouterProvider] Fetch error:', error);
        if (!result.content && result.tool_calls.length === 0) {
            result.content = `I ran into a connection issue. (${error.message})`;
        }
    }

    return result;
};

/**
 * Simple text completion via OpenRouter REST API.
 */
const complete = async (model, prompt, systemPrompt) => {
    const apiKey = getConfig()?.OPENROUTER_API_KEY;
    try {
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/jidagraphy/mylia',
                'X-Title': 'Mylia Agent'
            },
            body: JSON.stringify({
                model,
                messages,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
        }

        const json = await response.json();
        return json.choices?.[0]?.message?.content?.trim() || '';
    } catch (error) {
        console.error('[OpenRouterProvider] Complete fetch error:', error);
        return '';
    }
};

module.exports = { chat, complete };
