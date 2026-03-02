const fs = require('fs');
const path = require('path');
const { readMemory } = require('./memoryStore');
const { readSessionDiary } = require('./summarizer');

const agentMdPath = path.resolve(__dirname, '../Agent/agent.md');
const memoryDir = path.resolve(__dirname, '../Agent/Memory');

const loadAgentIdentity = () => fs.readFileSync(agentMdPath, 'utf-8');

const loadLongTermMemory = () => {
    const mem = readMemory();
    if (!mem) return '';
    return `## 장기 기억 (Long-Term Memory)\n${mem}`;
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
        const log = readSessionDiary(sessionId);
        if (log) {
            diaries += `\n\n## 세션 다이어리 (${sessionId})\n${log}`;
        }
    }
    return diaries.trim();
};

/**
 * Builds the full system instruction combining:
 * 1. Agent identity
 * 2. Long-term memory
 * 3. Recent session diaries
 */
const buildSystemInstruction = () => {
    const sections = [
        loadAgentIdentity(),
        loadLongTermMemory(),
        loadRecentSessionDiaries(2)
    ].filter(Boolean);

    return sections.join('\n\n');
};

module.exports = { buildSystemInstruction };
