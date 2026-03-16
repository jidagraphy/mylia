/**
 * Converts an internal message object to Gemini's Content format.
 */
const toGeminiContent = (msg) => {
    if (msg._rawParts) {
        return { role: 'model', parts: msg._rawParts };
    }
    if (msg.role === 'tool') {
        return {
            role: 'user', // Gemini function responses are sent as 'user'
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
                type: 'OBJECT', // Gemini requires uppercase types
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
 * Chat with tool support via Gemini REST API.
 */
const chat = async (model, systemInstruction, tools, history, currentMessage) => {
    const { getConfig } = require('../Utility/config');
    const apiKey = getConfig()?.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const contents = [...history, currentMessage].map(toGeminiContent);

    const payload = {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents
    };

    const geminiTools = toGeminiTools(tools);
    if (geminiTools && geminiTools.length > 0) {
        payload.tools = [{ functionDeclarations: geminiTools }];
    }

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(`Gemini API Error: ${data.error?.message || JSON.stringify(data)}`);
    }

    const candidate = data.candidates?.[0];
    if (!candidate) return { role: 'assistant', content: '', tool_calls: [] };

    const result = { role: 'assistant', content: '', tool_calls: [] };
    const parts = candidate.content?.parts || [];

    // Extract text
    const textPart = parts.find(p => p.text);
    if (textPart) result.content = textPart.text;

    // Extract function calls
    const functionCallParts = parts.filter(p => p.functionCall);
    if (functionCallParts.length > 0) {
        result.tool_calls = functionCallParts.map(fc => ({
            function: { name: fc.functionCall.name, arguments: fc.functionCall.args }
        }));
        // Store raw parts to echo back in history for next round
        result._rawParts = parts;
    }

    return result;
};

/**
 * Simple text completion via Gemini REST API (no tools, no history). Used for summarization.
 */
const complete = async (model, prompt) => {
    const { getConfig } = require('../Utility/config');
    const apiKey = getConfig()?.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    };

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(`Gemini API Error: ${data.error?.message || JSON.stringify(data)}`);

    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
};

module.exports = { chat, complete };
