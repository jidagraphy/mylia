const fs = require('fs');
const path = require('path');
const { getWorkspacePath } = require('./workspaceSetup');
const { error: logError } = require('./logger');

const storePath = () => path.join(getWorkspacePath(), 'crons.json');

const loadEntries = () => {
    const file = storePath();
    if (!fs.existsSync(file)) return [];
    try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        return Array.isArray(parsed?.entries) ? parsed.entries : [];
    } catch (e) {
        logError('Cron', `Failed to read crons.json: ${e.message}`);
        return [];
    }
};

const saveEntries = (entries) => {
    const file = storePath();
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ entries }, null, 2));
    fs.renameSync(tmp, file);
};

const addEntry = (entry) => {
    const entries = loadEntries();
    entries.push(entry);
    saveEntries(entries);
    return entry;
};

const removeEntry = (id) => {
    const entries = loadEntries().filter(e => e.id !== id);
    saveEntries(entries);
};

const updateEntry = (id, patch) => {
    const entries = loadEntries().map(e => (e.id === id ? { ...e, ...patch } : e));
    saveEntries(entries);
};

module.exports = { loadEntries, saveEntries, addEntry, removeEntry, updateEntry };
