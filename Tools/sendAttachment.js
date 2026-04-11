const fs = require('fs');
const path = require('path');
const { getWorkspacePath } = require('../Utility/workspaceSetup');

const MAX_BYTES = 25 * 1024 * 1024; // 25MB

const handler = async ({ filePath }) => {
    if (typeof filePath !== 'string' || !filePath.trim()) {
        return 'Error: filePath is required and must be a string.';
    }
    let resolved = filePath;
    if (resolved.startsWith('~')) {
        resolved = path.join(require('os').homedir(), resolved.slice(1));
    }
    if (!path.isAbsolute(resolved)) {
        resolved = path.resolve(getWorkspacePath(), resolved);
    }

    if (!fs.existsSync(resolved)) {
        return `Error: File not found: ${filePath}`;
    }

    try {
        const stat = fs.statSync(resolved);
        if (stat.size > MAX_BYTES) {
            return `Error: File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Max ${MAX_BYTES / 1024 / 1024}MB.`;
        }
        return {
            _attachment: { filePath: resolved, name: path.basename(resolved) },
            text: `Attachment queued: ${path.basename(resolved)} (${(stat.size / 1024).toFixed(1)}KB). It will be sent along with your next reply.`
        };
    } catch (error) {
        return `Error reading file: ${error.message}`;
    }
};

const declaration = {
    type: "function",
    function: {
        name: "send_attachment",
        description: "Queues a local file or image to be attached to your next reply in the Discord channel. Use this when the user asks you to share, post, or send a file or photo. Call it multiple times to attach multiple files in the same reply. Supports any file type up to 25MB. Relative paths resolve from the workspace root; ~ expands to home. Pair with `execute_shell screencapture` to send a screenshot, or with any file the user references on disk.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Path to the file to attach. Absolute, ~-prefixed, or relative to workspace root."
                }
            },
            required: ["filePath"]
        }
    }
};

module.exports = { handler, declaration };
