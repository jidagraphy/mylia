/**
 * Unified AI provider interface.
 * Reads AI_PROVIDER and AI_MODEL from process.env to route calls.
 */

const getProvider = () => {
    const providerName = process.env.AI_PROVIDER || 'ollama';

    switch (providerName) {
        case 'gemini':
            return require('./geminiProvider');
        case 'ollama':
            return require('./ollamaProvider');
        default:
            throw new Error(`Unknown AI_PROVIDER: ${providerName}`);
    }
};

const getModel = () => process.env.AI_MODEL || 'gemini-3-flash-preview';

/**
 * Chat with tool support.
 * @param {Array} history - Previous messages.
 * @param {string} systemInstruction - Full system prompt.
 * @param {Array} tools - Tool declarations.
 * @param {Object} message - Current message { role, content, name? }.
 * @returns {Promise<Object>} { role, content, tool_calls?, _rawParts? }
 */
const chat = (history, systemInstruction, tools, message) => {
    return getProvider().chat(getModel(), history, systemInstruction, tools, message);
};

/**
 * Simple text completion (no tools, no history).
 * @param {string} prompt - The prompt text.
 * @returns {Promise<string>} Completed text.
 */
const complete = (prompt) => {
    return getProvider().complete(getModel(), prompt);
};

module.exports = { chat, complete };
