const fs = require('fs');
const path = require('path');

const agentMdPath = path.resolve(__dirname, '../Agent/agent.md');
const soulFile = path.resolve(__dirname, '../Agent/soul.md');
const userFile = path.resolve(__dirname, '../Agent/user.md');
const memoryFile = path.resolve(__dirname, '../Agent/memory.md');
const memoryDir = path.resolve(__dirname, '../Agent/Memory');

const loadAgentIdentity = () => `=== AGENT ===\n${fs.readFileSync(agentMdPath, 'utf-8').trim()}`;

const loadSoul = () => {
    if (!fs.existsSync(soulFile)) return '';
    try {
        const soul = fs.readFileSync(soulFile, 'utf8').trim();
        if (!soul) return '';
        return `=== SOUL ===\n${soul}`;
    } catch {
        return '';
    }
};

const loadUser = () => {
    if (!fs.existsSync(userFile)) return '';
    try {
        const user = fs.readFileSync(userFile, 'utf8').trim();
        if (!user) return '';
        return `=== USER PROFILE ===\n${user}`;
    } catch {
        return '';
    }
};

const loadLongTermMemory = () => {
    if (!fs.existsSync(memoryFile)) return '';
    try {
        const mem = fs.readFileSync(memoryFile, 'utf8').trim();
        if (!mem) return '';
        return `=== LONG-TERM MEMORY ===\n${mem}`;
    } catch {
        return '';
    }
};

const loadRecentSessionDiaries = (count = 2) => {
    if (!fs.existsSync(memoryDir)) return '';

    const files = fs.readdirSync(memoryDir)
        .filter(f => f.endsWith('.md'))
        .sort((a, b) => b.localeCompare(a)) // Sort descending (newest first)
        .slice(0, count)
        .reverse(); // Reverse to chronological order (oldest first within the slice)

    if (files.length === 0) return '';

    let diaries = '';
    for (const file of files) {
        const sessionId = file.replace('.md', '');
        const filePath = path.join(memoryDir, `${sessionId}.md`);
        try { var log = fs.readFileSync(filePath, 'utf8').trim(); }
        catch { continue; }
        if (log) {
            diaries += `\n\n## Session Diary (${sessionId})\n${log}`;
        }
    }

    if (diaries) {
        return `=== RECENT SESSION DIARIES ===${diaries}`;
    }
    return '';
};

/**
 * Builds the full system instruction combining:
 * 1. Agent identity (agent.md)
 * 2. Soul (soul.md)
 * 3. User profile (user.md)
 * 4. Long-term memory (memory.md)
 * 5. Recent session diaries
 */
const buildSystemInstruction = () => {
    const sections = [
        loadAgentIdentity(),
        loadSoul(),
        loadUser(),
        loadLongTermMemory(),
        loadRecentSessionDiaries(2)
    ].filter(Boolean);

    return sections.join('\n\n');
};

module.exports = { buildSystemInstruction };
