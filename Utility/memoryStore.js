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
 * Appends a new fact to the memory.md file.
 * @param {string} fact - The fact to store.
 * @returns {string} Status message.
 */
const updateMemory = (fact) => {
    initMemory();
    try {
        const entry = `- ${new Date().toISOString().split('T')[0]}: ${fact}\n`;
        fs.appendFileSync(memoryFile, entry);
        return `Successfully saved fact: "${fact}"`;
    } catch (error) {
        console.error('Failed to update memory:', error);
        return `Error saving fact: ${error.message}`;
    }
};

/**
 * Reads the entire memory.md file.
 * @returns {string} The content of memory.md.
 */
const readMemory = () => {
    initMemory();
    try {
        return fs.readFileSync(memoryFile, 'utf8');
    } catch (error) {
        console.error('Failed to read memory:', error);
        return 'Error reading memory.';
    }
};

module.exports = {
    updateMemory,
    readMemory,
};
