const fs = require('fs');
const path = require('path');
const { getWorkspacePath } = require('../Utility/workspace');

const userFile = path.join(getWorkspacePath(), 'user.md');

/**
 * Initializes the user file from template if it doesn't exist.
 */
const initUser = () => {
    if (!fs.existsSync(userFile)) {
        fs.writeFileSync(userFile, '# User\n');
    }
};

/**
 * Rewrites user.md with the provided content.
 * Backs up the previous version to user.md.bak first.
 * @param {Object} args - { content: string }
 * @returns {Promise<string>}
 */
const handler = async ({ content }) => {
    initUser();
    try {
        fs.copyFileSync(userFile, `${userFile}.bak`);
        fs.writeFileSync(userFile, content, 'utf8');
        return 'User profile updated successfully.';
    } catch (error) {
        console.error('Failed to write user:', error);
        return `Error writing user: ${error.message}`;
    }
};

const declaration = {
    type: "function",
    function: {
        name: "updateUser",
        description: "Rewrites the entire user profile file (user.md) with the provided content. user.md contains facts about the user you are assisting. Read the current user profile from your system context first, then call this with the full updated content. Preserve existing facts unless they are outdated or incorrect.",
        parameters: {
            type: "object",
            properties: {
                content: { type: "string", description: "The complete new content for user.md, replacing everything currently in the file." }
            },
            required: ["content"]
        }
    }
};

module.exports = { handler, declaration };
