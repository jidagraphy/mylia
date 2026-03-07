const fs = require('fs');
const path = require('path');
const { getWorkspacePath } = require('../Utility/workspace');

const soulFile = path.join(getWorkspacePath(), 'soul.md');

const initSoul = () => {
    if (!fs.existsSync(soulFile)) {
        fs.writeFileSync(soulFile, '# Soul\n');
    }
};

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
    type: "function",
    function: {
        name: "updateSoul",
        description: "Rewrites the entire soul file (soul.md) with the provided content. soul.md defines your core personality, boundaries, and vibe. Read your current soul from the system context first, then call this with the full updated content. Preserve existing traits unless explicitly asked to change them.",
        parameters: {
            type: "object",
            properties: {
                content: { type: "string", description: "The complete new content for soul.md, replacing everything currently in the file." }
            },
            required: ["content"]
        }
    }
};

module.exports = { handler, declaration };
