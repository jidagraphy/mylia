const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT_DIR = path.join(__dirname, '..');

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

// default file buildup logic
// when called, creates workspace directory, copies files from WorkspaceTemplate if not present.
// called by app.js on startup.
function setupWorkspaceEnvironment() {
    const workspacePath = getWorkspacePath();
    const templateDir = path.join(ROOT_DIR, 'WorkspaceTemplate');

    if (!fs.existsSync(workspacePath)) {
        fs.mkdirSync(workspacePath, { recursive: true });
    }

    const directoriesToEnsure = ['Sessions', 'Memory', 'Skills'];
    for (const dir of directoriesToEnsure) {
        const targetPath = path.join(workspacePath, dir);
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }
    }

    const filesToCopy = ['agent.md', 'memory.md', 'soul.md', 'user.md'];
    for (const file of filesToCopy) {
        const sourcePath = path.join(templateDir, file);
        const targetPath = path.join(workspacePath, file);

        if (!fs.existsSync(targetPath)) {
            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, targetPath);
            } else {
                console.warn(`[Setup] Template file ${file} not found.`);
            }
        }
    }
}

module.exports = { getWorkspacePath, setupWorkspaceEnvironment };
