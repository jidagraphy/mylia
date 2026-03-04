const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({});

/**
 * Converts an internal message object to Gemini's Content format.
 */
const toGeminiContent = (msg) => {
    if (msg._rawParts) {
        return { role: 'model', parts: msg._rawParts };
    }
    if (msg.role === 'tool') {
        return {
            role: 'user',
            parts: [{ functionResponse: { name: msg.name, response: { result: msg.content } } }]
        };
    }
    return {
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }]
    };
};

/**
 * Converts OpenAI-format tool declarations to Gemini's format.
 */
const toGeminiTools = (openAiTools) => {
    if (!openAiTools?.length) return undefined;
    return openAiTools.map(t => {
        const fn = t.function;
        return {
            name: fn.name,
            description: fn.description,
            parameters: {
                type: 'OBJECT', // Gemini requires uppercase
                properties: Object.fromEntries(
                    Object.entries(fn.parameters?.properties || {}).map(([k, v]) => [
                        k, { type: v.type.toUpperCase(), description: v.description }
                    ])
                ),
                required: fn.parameters?.required || []
            }
        };
    });
};

/**
 * Chat with tool support via Gemini.
 */
const chat = async (model, history, systemInstruction, tools, currentMessage) => {
    const config = { systemInstruction };
    const geminiTools = toGeminiTools(tools);
    if (geminiTools?.length > 0) config.tools = [{ functionDeclarations: geminiTools }];

    const session = ai.chats.create({
        model,
        config,
        history: history.map(toGeminiContent),
    });

    const parts = currentMessage.role === 'tool'
        ? [{ functionResponse: { name: currentMessage.name, response: { result: currentMessage.content } } }]
        : [{ text: currentMessage.content }];

    const response = await session.sendMessage({ message: parts });

    const result = { role: 'assistant', content: '', tool_calls: [] };

    if (response.functionCalls?.length > 0) {
        result.tool_calls = response.functionCalls.map(fc => ({
            function: { name: fc.name, arguments: fc.args }
        }));
        const rawParts = response.candidates?.[0]?.content?.parts;
        if (rawParts) result._rawParts = rawParts;
    }

    if (response.text) result.content = response.text;

    return result;
};

/**
 * Simple text completion (no tools, no history). Used for summarization.
 */
const complete = async (model, prompt) => {
    const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return response.text?.trim() || '';
};

module.exports = { chat, complete };
