const { getConfig } = require('../Utility/config');
const config = getConfig() || {};
const provider = config.AI_PROVIDER;
const model = config.AI_MODEL;

const getActiveProvider = () => {

    try {
        return require(`./${provider}Provider`);
    } catch (error) {
        throw new Error(`Configured AI_PROVIDER '${providerName}' not found or failed to load.`);
    }
};


const chat = (history, systemInstruction, tools, message) => {
    return getActiveProvider().chat(model, history, systemInstruction, tools, message);
};

const complete = (prompt) => {
    return getActiveProvider().complete(model, prompt);
};

module.exports = { chat, complete };

