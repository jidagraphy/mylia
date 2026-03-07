const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');


// default file buildup logic
// when called, creates workspace directory, copies files from AgentTemplate if not present.
// called by app.js on startup.

function setupAgentEnvironment() {
    const { getWorkspacePath } = require('./workspace');
    const workspacePath = getWorkspacePath();
    const templateDir = path.join(ROOT_DIR, 'AgentTemplate');

    if (!fs.existsSync(workspacePath)) {
        fs.mkdirSync(workspacePath, { recursive: true });
    }

    const directoriesToEnsure = ['Sessions', 'Memory'];
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

module.exports = { setupAgentEnvironment };
