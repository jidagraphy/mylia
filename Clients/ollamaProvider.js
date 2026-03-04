const { Ollama } = require('ollama');

// Force localhost — ollama-js reads OLLAMA_HOST internally, override it
process.env.OLLAMA_HOST = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });

/**
 * Converts Gemini-format tool declarations to Ollama/OpenAI format.
 */
const toOllamaTools = (geminiTools) => {
    if (!geminiTools?.length) return undefined;
    return geminiTools.map(t => ({
        type: 'function',
        function: {
            name: t.name,
            description: t.description,
            parameters: {
                type: 'object',
                properties: Object.fromEntries(
                    Object.entries(t.parameters.properties || {}).map(([k, v]) => [
                        k, { type: v.type.toLowerCase(), description: v.description }
                    ])
                ),
                required: t.parameters.required || []
            }
        }
    }));
};

/**
 * Chat with tool support via local Ollama.
 */
const chat = async (model, history, systemInstruction, tools, currentMessage) => {
    const formatMessage = (msg) => {
        if (msg.role === 'tool') {
            return { role: 'tool', content: msg.content || '', name: msg.name || 'unknown_tool' };
        }
        if (msg.role === 'assistant') {
            const out = { role: 'assistant', content: msg.content || '' };
            if (msg.tool_calls && msg.tool_calls.length > 0) {
                out.tool_calls = msg.tool_calls.map(tc => ({
                    function: { name: tc.function.name, arguments: tc.function.arguments }
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

    // If currentMessage was a tool, we appended a textPrompt in index.js for Gemini.
    // For Ollama/OpenAI, we should add that as an explicit user message.
    if (currentMessage.role === 'tool' && currentMessage.textPrompt) {
        messages.push({ role: 'user', content: currentMessage.textPrompt });
    }

    const options = { model, messages, stream: true };
    const ollamaTools = toOllamaTools(tools);
    if (ollamaTools) options.tools = ollamaTools;

    // Uncomment this to see exactly what is sent to the AI
    // console.log('[OllamaProvider] Sending messages:', JSON.stringify(messages, null, 2));

    const result = { role: 'assistant', content: '', tool_calls: [] };

    const stream = await ollama.chat(options);
    for await (const chunk of stream) {
        if (chunk.message?.content) {
            result.content += chunk.message.content;
        }

        if (chunk.message?.tool_calls?.length > 0) {
            result.tool_calls = chunk.message.tool_calls.map(tc => ({
                function: { name: tc.function.name, arguments: tc.function.arguments }
            }));
        }
    }

    return result;
};

/**
 * Simple text completion via local Ollama.
 */
const complete = async (model, prompt) => {
    const response = await ollama.chat({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false
    });
    return response.message?.content?.trim() || '';
};

module.exports = { chat, complete };
