const fs = require('fs');
const path = require('path');

function setupAgentEnvironment() {
    const rootDir = path.join(__dirname, '..');
    const agentDir = path.join(rootDir, 'Agent');
    const templateDir = path.join(rootDir, 'AgentTemplate');

    if (!fs.existsSync(agentDir)) {
        fs.mkdirSync(agentDir, { recursive: true });
    }

    const directoriesToEnsure = ['ChatHistory', 'Memory'];
    for (const dir of directoriesToEnsure) {
        const targetPath = path.join(agentDir, dir);
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }
    }

    const filesToCopy = ['agent.md', 'memory.md'];
    for (const file of filesToCopy) {
        const sourcePath = path.join(templateDir, file);
        const targetPath = path.join(agentDir, file);

        if (!fs.existsSync(targetPath)) {
            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, targetPath);
            } else {
                console.warn(`[agentSetup] Template file ${sourcePath} not found.`);
            }
        }
    }
}

module.exports = { setupAgentEnvironment };
