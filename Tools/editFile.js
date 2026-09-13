const fs = require('fs');
const path = require('path');
const { getWorkspacePath } = require('../Utility/workspaceSetup');
const { looseRegex } = require('../Utility/textMatch');

// Surgical edits only: the model never retypes a whole file, so it can't silently drop content.
const handler = async ({ filePath, oldText, newText }) => {
    if (typeof filePath !== 'string' || !filePath.trim()) return 'Error: filePath is required.';
    if (typeof newText !== 'string') {
        return 'Error: newText is required. To append, pass only newText. To change existing text, pass oldText and newText. (There is no "content" parameter.)';
    }
    const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(getWorkspacePath(), filePath);

    try {
        const previous = fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf8') : null;

        if (!oldText) {
            if (!newText) return 'Error: nothing to append — newText is empty.';
            if (previous === null) {
                fs.mkdirSync(path.dirname(resolved), { recursive: true });
                fs.writeFileSync(resolved, newText, 'utf8');
                return `Created "${filePath}".`;
            }
            fs.copyFileSync(resolved, `${resolved}.bak`);
            const separator = previous === '' || previous.endsWith('\n') ? '' : '\n';
            fs.appendFileSync(resolved, separator + newText, 'utf8');
            return `Appended to "${filePath}".`;
        }

        if (previous === null) return `Error: "${filePath}" does not exist. To create it, omit oldText.`;
        const ambiguous = (n) => `Error: oldText matches ${n} times in "${filePath}". Include more surrounding text so it matches exactly once.`;
        const notFound = `Error: oldText not found in "${filePath}". Use read_file and copy the text exactly.`;

        let content = previous;
        let start, end, loose = false;
        const exact = previous.split(oldText).length - 1;
        if (exact > 1) return ambiguous(exact);
        if (exact === 1) {
            start = previous.indexOf(oldText);
            end = start + oldText.length;
        } else {
            // Fallback: ignore whitespace + Unicode normalization. Still must match exactly once.
            // A loose edit saves the file NFC-normalized (visually identical).
            content = previous.normalize('NFC');
            const pattern = looseRegex(oldText, 'gu');
            const found = pattern ? [...content.matchAll(pattern)] : [];
            if (found.length === 0) return notFound;
            if (found.length > 1) return ambiguous(found.length);
            start = found[0].index;
            end = start + found[0][0].length;
            loose = true;
        }

        fs.copyFileSync(resolved, `${resolved}.bak`);
        // slice instead of String.replace: newText may contain "$&"-style patterns.
        fs.writeFileSync(resolved, content.slice(0, start) + newText + content.slice(end), 'utf8');
        const line = content.slice(0, start).split('\n').length;
        return `Replaced 1 match in "${filePath}" (line ${line})${loose ? ', matched ignoring whitespace differences' : ''}.`;
    } catch (error) {
        return `Error editing file: ${error.message}`;
    }
};

const declaration = {
    type: "function",
    function: {
        name: "edit_file",
        description: "Edits a file without rewriting it. Append: pass only newText — it is added to the end of the file (the file and folders are created if missing); no need to read first. Replace: pass oldText and newText — oldText must match exactly once, so copy it from read_file; use newText \"\" to delete. Backs up to .bak. Relative paths resolve from the workspace root.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "File path. Relative paths resolve from workspace root (e.g., 'memory.md'). Absolute paths are used as-is."
                },
                oldText: {
                    type: "string",
                    description: "Optional. Exact existing text to replace. Omit to append."
                },
                newText: {
                    type: "string",
                    description: "Text to append, or the replacement for oldText."
                }
            },
            required: ["filePath", "newText"]
        }
    }
};

module.exports = { handler, declaration };
