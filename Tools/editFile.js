const fs = require('fs');
const path = require('path');
const { getWorkspacePath } = require('../Utility/workspaceSetup');

const handler = async ({ filePath, mode, content, oldContent, newContent }) => {
    // Resolve relative paths against workspace, absolute paths used as-is
    const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(getWorkspacePath(), filePath);

    // Ensure parent directory exists
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    try {
        // Backup existing file before any edit
        if (fs.existsSync(resolved)) {
            fs.copyFileSync(resolved, `${resolved}.bak`);
        }

        if (mode === 'replace') {
            if (!oldContent || !newContent === undefined) {
                return 'Error: "replace" mode requires both oldContent and newContent parameters.';
            }

            const current = fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf8') : '';

            if (!current.includes(oldContent)) {
                return `Error: Could not find the specified text to replace. Use readFile first to see the current content.\n\nSearched for:\n${oldContent}`;
            }

            const updated = current.replace(oldContent, newContent);
            fs.writeFileSync(resolved, updated, 'utf8');
            return `File "${filePath}" updated (replaced matching text).`;

        } else if (mode === 'append') {
            const current = fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf8') : '';
            fs.writeFileSync(resolved, current + '\n' + content, 'utf8');
            return `File "${filePath}" updated (appended content).`;

        } else if (mode === 'rewrite') {
            if (!content) {
                return 'Error: "rewrite" mode requires the content parameter.';
            }
            fs.writeFileSync(resolved, content, 'utf8');
            return `File "${filePath}" fully rewritten.`;

        } else {
            return 'Error: Invalid mode. Use "replace", "append", or "rewrite".';
        }
    } catch (error) {
        return `Error editing file: ${error.message}`;
    }
};

const declaration = {
    type: "function",
    function: {
        name: "editFile",
        description: "Edits a file. Supports three modes: 'replace' (find-and-replace exact text), 'append' (add to end of file), and 'rewrite' (full file replacement — use with caution). Always use readFile first to see current content before editing. Relative paths resolve from the workspace root.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "File path. Relative paths resolve from workspace root (e.g., 'memory.md'). Absolute paths are used as-is."
                },
                mode: {
                    type: "string",
                    description: "Edit mode: 'replace' (find-and-replace), 'append' (add to end), or 'rewrite' (full replacement)"
                },
                oldContent: {
                    type: "string",
                    description: "The exact text to find and replace (required for 'replace' mode)"
                },
                newContent: {
                    type: "string",
                    description: "The replacement text (required for 'replace' mode)"
                },
                content: {
                    type: "string",
                    description: "The content to append or the full new content (required for 'append' and 'rewrite' modes)"
                }
            },
            required: ["filePath", "mode"]
        }
    }
};

module.exports = { handler, declaration };
