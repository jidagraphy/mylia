const { updateMemory } = require('../Utility/memoryStore');

/**
 * Saves a fact to long-term memory.
 * @param {Object} args - { fact: string }
 * @returns {Promise<string>}
 */
const handler = async ({ fact }) => {
    return updateMemory(fact);
};

const declaration = {
    name: "updateMemory",
    description: "Saves a concise, important fact about the user to long-term memory (memory.md). Use for permanent facts: name, preferences, decisions.",
    parameters: {
        type: "OBJECT",
        properties: {
            fact: { type: "STRING", description: "The concrete fact to remember." }
        },
        required: ["fact"]
    }
};

module.exports = { handler, declaration };
