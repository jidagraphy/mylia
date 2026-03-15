const fs = require('fs');
const path = require('path');
const { getWorkspacePath } = require('./workspace');
const { getInstalledSkills } = require('./skillManager');

const agentMdPath = path.join(getWorkspacePath(), 'agent.md');
const soulFile = path.join(getWorkspacePath(), 'soul.md');
const userFile = path.join(getWorkspacePath(), 'user.md');
const memoryFile = path.join(getWorkspacePath(), 'memory.md');
const memoryDir = path.join(getWorkspacePath(), 'Memory');

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
        .sort((a, b) => b.localeCompare(a))
        .slice(0, count)
        .reverse();

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

const loadAvailableSkills = () => {
    const skills = getInstalledSkills();
    if (skills.length === 0) return '';

    let skillsList = '=== AVAILABLE SKILLS ===\n';
    skillsList += 'You have access to specialized skill packages. If a task requires it, you MUST use the `viewSkill` tool to read the skill\'s instructions before proceeding.\n\n';
    
    for (const skill of skills) {
        skillsList += `- **${skill.name || skill.folder}**: ${skill.description}\n`;
    }

    return skillsList.trim();
};

/**
 * agent.md
 * soul.md
 * user.md
 * memory.md
 * recent session diaries
 */
const buildSystemInstruction = () => {
    const sections = [
        loadAgentIdentity(),
        loadAvailableSkills(),
        loadSoul(),
        loadUser(),
        loadLongTermMemory(),
        loadRecentSessionDiaries(2)
    ].filter(Boolean);

    return sections.join('\n\n');
};

module.exports = { buildSystemInstruction };
