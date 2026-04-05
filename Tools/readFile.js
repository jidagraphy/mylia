const fs = require('fs');
const path = require('path');
const { getWorkspacePath } = require('../Utility/workspaceSetup');

const handler = async ({ filePath }) => {
    // Resolve relative paths against workspace, absolute paths used as-is
    const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(getWorkspacePath(), filePath);

    if (!fs.existsSync(resolved)) {
        return `Error: File not found: ${filePath}`;
    }

    try {
        const buffer = fs.readFileSync(resolved);

        // Detect binary files by checking for null bytes
        if (buffer.includes(0x00)) {
            return `Error: "${filePath}" appears to be a binary file and cannot be read as text.`;
        }

        const content = buffer.toString('utf8');
        if (!content.trim()) return `File "${filePath}" is empty.`;
        return content;
    } catch (error) {
        return `Error reading file: ${error.message}`;
    }
};

const declaration = {
    type: "function",
    function: {
        name: "read_file",
        description: "Reads the content of a file. Use this to check the current content of memory.md, soul.md, user.md, or any other file before making changes. Relative paths resolve from the workspace root. Always use read_file before edit_file.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "File path. Relative paths resolve from workspace root (e.g., 'memory.md'). Absolute paths are used as-is (e.g., '/Users/jida/file.txt')."
                }
            },
            required: ["filePath"]
        }
    }
};

module.exports = { handler, declaration };
