const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/**
 * Chat with tool support via OpenRouter REST API (OpenAI format).
 */
const chat = async (model, history, systemInstruction, tools, currentMessage) => {
    const formatMessage = (msg) => {
        if (msg.role === 'tool') {
            return { role: 'tool', tool_call_id: msg.tool_call_id || 'unknown', content: msg.content || '', name: msg.name || 'unknown_tool' };
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
        return { role: 'user', content: msg.content || '' };
    };

    const messages = [
        { role: 'system', content: systemInstruction },
        ...history.map(formatMessage),
        formatMessage(currentMessage)
    ];

    if (currentMessage.role === 'tool' && currentMessage.textPrompt) {
        messages.push({ role: 'user', content: currentMessage.textPrompt });
    }

    const payload = { model, messages, stream: true };
    if (tools?.length > 0) payload.tools = tools;

    const result = { role: 'assistant', content: '', tool_calls: [] };
    const toolCallsMap = {}; // Used to accumulate streamed tool arguments

    if (!OPENROUTER_API_KEY) {
        console.error('[OpenRouterProvider] Missing OPENROUTER_API_KEY in .env');
        return Object.assign(result, { content: 'System Error: OpenRouter API key is missing.' });
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
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

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkString = decoder.decode(value, { stream: true });
            const lines = chunkString.split('\n').filter(line => line.trim() !== '');

            for (let line of lines) {
                if (!line.startsWith('data: ')) continue;
                if (line === 'data: [DONE]') break;

                try {
                    const chunk = JSON.parse(line.substring(6));
                    const delta = chunk.choices?.[0]?.delta;

                    if (delta?.content) {
                        result.content += delta.content;
                        // Print directly to console for streaming effect
                        process.stdout.write(delta.content);
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
                    // Ignore incomplete JSON chunks from SSE boundaries
                }
            }
        }

        // Finalize accumulated tool calls
        if (Object.keys(toolCallsMap).length > 0) {
            result.tool_calls = Object.values(toolCallsMap).map(fn => ({
                id: fn.id,
                function: { name: fn.name, arguments: fn.arguments }
            }));
            console.log('\n[OpenRouterProvider] Emitting built Tool Calls:', JSON.stringify(result.tool_calls));
        } else {
            console.log(''); // newline after text stream
        }

    } catch (error) {
        console.error('\n[OpenRouterProvider] Fetch error:', error);
    }

    return result;
};

/**
 * Simple text completion via OpenRouter REST API.
 */
const complete = async (model, prompt) => {
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/jidagraphy/mylia',
                'X-Title': 'Mylia Agent'
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
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
