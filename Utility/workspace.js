const fs = require('fs');
const path = require('path');
const os = require('os');


const getWorkspacePath = () => {
    const ws = process.env.WORKSPACE_PATH;
    if (!ws || !ws.trim()) {
        console.error('[mylia] WORKSPACE_PATH not set. Run the app to complete setup.');
        process.exit(1);
    }

    const resolved = ws.startsWith('~')
        ? path.resolve(os.homedir(), ws.slice(2))
        : path.resolve(ws);

    if (!fs.existsSync(resolved)) {
        fs.mkdirSync(resolved, { recursive: true });
        console.log(`[mylia] Created workspace: ${resolved}`);
    }

    try {
        fs.accessSync(resolved, fs.constants.R_OK | fs.constants.W_OK);
    } catch {
        console.error(`[mylia] No read/write permission for workspace: ${resolved}`);
        process.exit(1);
    }

    return resolved;
};

module.exports = { getWorkspacePath };
