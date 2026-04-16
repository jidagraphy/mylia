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
    const parts = [];
    if (msg.content) parts.push({ text: msg.content });
    if (msg.images?.length > 0) {
        for (const img of msg.images) {
            parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
        }
    }
    return { role: msg.role === 'assistant' ? 'model' : msg.role, parts };
};

/**
 * Recursively converts a JSON Schema node to Gemini's format (uppercase types,
 * nested objects/arrays, enum passthrough).
 */
const toGeminiSchema = (schema) => {
    if (!schema) return {};
    const rawType = Array.isArray(schema.type) ? schema.type[0] : schema.type;
    const result = { type: (rawType || 'STRING').toUpperCase() };
    if (schema.description) result.description = schema.description;
    if (schema.enum) result.enum = schema.enum;
    if (rawType === 'object' && schema.properties) {
        result.properties = Object.fromEntries(
            Object.entries(schema.properties).map(([k, v]) => [k, toGeminiSchema(v)])
        );
        if (schema.required) result.required = schema.required;
    }
    if (rawType === 'array' && schema.items) {
        result.items = toGeminiSchema(schema.items);
    }
    return result;
};

/**
 * Converts OpenAI-format tool declarations to Gemini's format.
 */
const toGeminiTools = (openAiTools) => {
    if (!openAiTools?.length) return undefined;
    return openAiTools.map(t => {
        const fn = t.function;
        const params = fn.parameters || {};
        return {
            name: fn.name,
            description: fn.description,
            parameters: {
                type: 'OBJECT',
                properties: Object.fromEntries(
                    Object.entries(params.properties || {}).map(([k, v]) => [k, toGeminiSchema(v)])
                ),
                required: params.required || []
            }
        };
    });
};

/**
 * Chat with tool support via Gemini REST API.
 */
const chat = async (model, systemInstruction, tools, messages) => {
    const { getConfig } = require('../Utility/config');
    const apiKey = getConfig()?.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Convert and merge consecutive same-role turns (Gemini requires strict alternation)
    const rawContents = messages.map(toGeminiContent);
    const contents = [];
    for (const c of rawContents) {
        const prev = contents[contents.length - 1];
        if (prev && prev.role === c.role) {
            prev.parts.push(...c.parts);
        } else {
            contents.push(c);
        }
    }

    const payload = {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents
    };

    const geminiTools = toGeminiTools(tools);
    if (geminiTools && geminiTools.length > 0) {
        payload.tools = [{ functionDeclarations: geminiTools }];
    }

    const result = { role: 'assistant', content: '', tool_calls: [] };

    try {
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
        if (!candidate) return result;

        const parts = candidate.content?.parts || [];

        // Extract text (skip thinking parts returned by reasoning models)
        const textPart = parts.find(p => p.text && !p.thought);
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
    } catch (error) {
        console.error('[GeminiProvider] Fetch error:', error);
    }

    return result;
};

/**
 * Simple text completion via Gemini REST API (no tools, no history). Used for summarization.
 */
const complete = async (model, prompt, systemPrompt) => {
    const { getConfig } = require('../Utility/config');
    const apiKey = getConfig()?.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    };
    if (systemPrompt) {
        payload.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(`Gemini API Error: ${data.error?.message || JSON.stringify(data)}`);

        // Filter out thinking parts (thought: true) and only keep the actual answer
        const parts = data.candidates?.[0]?.content?.parts || [];
        const answerParts = parts.filter(p => !p.thought);
        return answerParts.map(p => p.text).join('').trim() || '';
    } catch (error) {
        console.error('[GeminiProvider] Complete fetch error:', error);
        return '';
    }
};

module.exports = { chat, complete };
