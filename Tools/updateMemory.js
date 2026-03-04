const fs = require('fs');
const path = require('path');

const memoryFile = path.resolve(__dirname, '../Agent/memory.md');

/**
 * Initializes the memory file if it doesn't exist.
 */
const initMemory = () => {
    if (!fs.existsSync(memoryFile)) {
        fs.writeFileSync(memoryFile, '# Agent Memory\n\nThis file contains learned facts about the user.\n\n');
    }
};

/**
 * Rewrites memory.md with the provided content.
 * Backs up the previous version to memory.md.bak first.
 * @param {Object} args - { content: string }
 * @returns {Promise<string>}
 */
const handler = async ({ content }) => {
    initMemory();
    try {
        fs.copyFileSync(memoryFile, `${memoryFile}.bak`);
        fs.writeFileSync(memoryFile, content, 'utf8');
        return 'Memory updated successfully.';
    } catch (error) {
        console.error('Failed to write memory:', error);
        return `Error writing memory: ${error.message}`;
    }
};

const declaration = {
    type: "function",
    function: {
        name: "updateMemory",
        description: "Rewrites the entire long-term memory file (memory.md) with the provided content. Use readMemory first via your system context to see current facts, then call this with the full updated file content. Preserve existing facts unless they are outdated or incorrect. Keep entries concise.",
        parameters: {
            type: "object",
            properties: {
                content: { type: "string", description: "The complete new content for memory.md, replacing everything currently in the file." }
            },
            required: ["content"]
        }
    }
};

module.exports = { handler, declaration };
