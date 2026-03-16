const fs = require('fs');
const path = require('path');
const os = require('os');

const WORKSPACE_PATH = path.join(os.homedir(), '.mylia');
const CONFIG_FILE = path.join(WORKSPACE_PATH, 'config.json');

const getConfig = () => {
    if (!fs.existsSync(CONFIG_FILE)) {
        return null;
    }
    try {
        const content = fs.readFileSync(CONFIG_FILE, 'utf8');
        return JSON.parse(content);
    } catch (e) {
        console.error('[mylia] Error reading config.json:', e.message);
        return null;
    }
};

const updateConfig = (newSettings) => {
    let currentConfig = getConfig() || {};
    const updated = { ...currentConfig, ...newSettings };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));
    return updated;
};

module.exports = {
    getConfig,
    updateConfig,
    WORKSPACE_PATH,
    CONFIG_FILE
};
