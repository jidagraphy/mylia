const fs = require('fs');
const path = require('path');
const { getWorkspacePath } = require('../Utility/workspaceSetup');

const handler = async ({ filePath, content }) => {
    const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(getWorkspacePath(), filePath);

    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    try {
        const previous = fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf8') : null;

        if (previous !== null) {
            fs.copyFileSync(resolved, `${resolved}.bak`);
        }

        fs.writeFileSync(resolved, content, 'utf8');

        if (previous === null) {
            return `File "${filePath}" created.`;
        }
        return `File "${filePath}" updated. Previous content (backed up to .bak):\n${previous}`;
    } catch (error) {
        return `Error editing file: ${error.message}`;
    }
};

const declaration = {
    type: "function",
    function: {
        name: "editFile",
        description: "Edits a file by replacing its content. Always use readFile first to see the current content before editing. Automatically backs up the existing file to .bak. Relative paths resolve from the workspace root.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "File path. Relative paths resolve from workspace root (e.g., 'memory.md'). Absolute paths are used as-is."
                },
                content: {
                    type: "string",
                    description: "The complete new content for the file."
                }
            },
            required: ["filePath", "content"]
        }
    }
};

module.exports = { handler, declaration };
