const { getConfig } = require('../Utility/config');

const getActiveProvider = () => {
    const provider = getConfig()?.AI_PROVIDER;
    if (!provider) throw new Error('AI_PROVIDER is not set in config.json.');
    return require(`./${provider}Provider`);
};

// turnOptions: { sessionId, resumeSession, modelOverride, onToolCalls }.
// onToolCalls(toolCalls) is called by providers that run tools internally (claudecode), for live step messages.
// Providers that replay `messages` ignore the session fields; claudecode keeps its own session instead.
const chat = (systemInstruction, tools, messages, turnOptions = {}) =>
    getActiveProvider().chat(turnOptions.modelOverride || getConfig()?.AI_MODEL, systemInstruction, tools, messages, turnOptions);

const complete = (prompt, systemPrompt) =>
    getActiveProvider().complete(getConfig()?.AI_MODEL, prompt, systemPrompt);

module.exports = { chat, complete };

