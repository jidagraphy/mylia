const { getConfig } = require('../Utility/config');
const config = getConfig() || {};
const provider = config.AI_PROVIDER;
const model = config.AI_MODEL;

const getActiveProvider = () => {

    try {
        return require(`./${provider}Provider`);
    } catch (error) {
        throw new Error(`Configured AI_PROVIDER '${provider}' not found or failed to load.`);
    }
};


const chat = (systemInstruction, tools, messages) => {
    return getActiveProvider().chat(model, systemInstruction, tools, messages);
};

const complete = (prompt, systemPrompt) => {
    return getActiveProvider().complete(model, prompt, systemPrompt);
};

module.exports = { chat, complete };

