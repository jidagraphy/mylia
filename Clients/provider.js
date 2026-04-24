const { getConfig } = require('../Utility/config');

const getActiveProvider = () => {
    const provider = getConfig()?.AI_PROVIDER;
    if (!provider) throw new Error('AI_PROVIDER is not set in config.json.');
    return require(`./${provider}Provider`);
};

const chat = (systemInstruction, tools, messages) =>
    getActiveProvider().chat(getConfig()?.AI_MODEL, systemInstruction, tools, messages);

const complete = (prompt, systemPrompt) =>
    getActiveProvider().complete(getConfig()?.AI_MODEL, prompt, systemPrompt);

module.exports = { chat, complete };

