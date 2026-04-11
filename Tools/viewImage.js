const fs = require('fs');
const path = require('path');
const { getWorkspacePath } = require('../Utility/workspaceSetup');

const EXT_TO_MIME = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.heic': 'image/heic',
};

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

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
        return `Error: Image not found: ${filePath}`;
    }

    const ext = path.extname(resolved).toLowerCase();
    const mimeType = EXT_TO_MIME[ext];
    if (!mimeType) {
        return `Error: Unsupported image extension "${ext}". Supported: ${Object.keys(EXT_TO_MIME).join(', ')}`;
    }

    try {
        const stat = fs.statSync(resolved);
        if (stat.size > MAX_BYTES) {
            return `Error: Image too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Max ${MAX_BYTES / 1024 / 1024}MB.`;
        }
        const buffer = fs.readFileSync(resolved);
        return {
            _image: { data: buffer.toString('base64'), mimeType },
            text: `Image loaded from ${resolved} (${mimeType}, ${(stat.size / 1024).toFixed(1)}KB). It is attached to the next turn for you to view.`
        };
    } catch (error) {
        return `Error reading image: ${error.message}`;
    }
};

const declaration = {
    type: "function",
    function: {
        name: "view_image",
        description: "Loads an image file from disk so you can visually inspect it on the next turn. Use this when the user references a local image file, or after capturing a screenshot (e.g. via execute_shell `screencapture ~/Desktop/shot.png`) to see what's on screen. Supported formats: png, jpg, jpeg, gif, webp, bmp, heic. Relative paths resolve from the workspace root; ~ expands to home.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Path to the image file. Absolute, ~-prefixed, or relative to workspace root."
                }
            },
            required: ["filePath"]
        }
    }
};

module.exports = { handler, declaration };
