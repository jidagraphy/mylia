
const provider = process.env.AI_PROVIDER;
const model = process.env.AI_MODEL;

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

