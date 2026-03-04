const fs = require('fs');
const path = require('path');

const soulFile = path.resolve(__dirname, '../Agent/soul.md');

/**
 * Initializes the soul file from template if it doesn't exist.
 */
const initSoul = () => {
    if (!fs.existsSync(soulFile)) {
        fs.writeFileSync(soulFile, '# Soul\n');
    }
};

/**
 * Rewrites soul.md with the provided content.
 * Backs up the previous version to soul.md.bak first.
 * @param {Object} args - { content: string }
 * @returns {Promise<string>}
 */
const handler = async ({ content }) => {
    initSoul();
    try {
        fs.copyFileSync(soulFile, `${soulFile}.bak`);
        fs.writeFileSync(soulFile, content, 'utf8');
        return 'Soul updated successfully.';
    } catch (error) {
        console.error('Failed to write soul:', error);
        return `Error writing soul: ${error.message}`;
    }
};

const declaration = {
    name: "updateSoul",
    description: "Rewrites the entire soul file (soul.md) with the provided content. soul.md defines your core personality, boundaries, and vibe. Read your current soul from the system context first, then call this with the full updated content. Preserve existing traits unless explicitly asked to change them.",
    parameters: {
        type: "OBJECT",
        properties: {
            content: { type: "STRING", description: "The complete new content for soul.md, replacing everything currently in the file." }
        },
        required: ["content"]
    }
};

module.exports = { handler, declaration };
