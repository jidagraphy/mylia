const fs = require('fs');
const os = require('os');
const path = require('path');
const { getWorkspacePath } = require('./workspaceSetup');
const { getInstalledSkills } = require('./skillManager');
const { getConfig } = require('./config');

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
    skillsList += 'You have access to specialized skill packages. If a task requires it, you MUST use the `view_skill` tool to read the skill\'s instructions before proceeding.\n\n';

    for (const skill of skills) {
        skillsList += `- **${skill.name || skill.folder}**: ${skill.description}\n`;
    }

    return skillsList.trim();
};

const loadRuntimeContext = (turnContext = {}) => {
    const { channel, client, actor, trigger } = turnContext;
    const config = getConfig() || {};

    const lines = ['=== CURRENT CONTEXT ==='];

    const now = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    lines.push(`Current time: ${now.toLocaleString()} (${tz})`);

    lines.push(`Host: ${os.hostname()} — ${os.platform()} ${os.release()} (user: ${os.userInfo().username})`);

    if (config.AI_PROVIDER || config.AI_MODEL) {
        lines.push(`Model: ${config.AI_MODEL || 'unknown'} via ${config.AI_PROVIDER || 'unknown'}`);
    }

    if (client?.user) {
        lines.push(`Logged in as: ${client.user.tag} (id: ${client.user.id})`);
    }

    if (channel) {
        const guild = channel.guild;
        lines.push('');
        if (guild) {
            lines.push(`You are responding in channel #${channel.name || 'unknown'} (id: ${channel.id})`);
            lines.push(`Server: ${guild.name} (id: ${guild.id})`);
            if (actor) lines.push(`Speaking with: @${actor.username} (id: ${actor.id})`);
        } else if (actor) {
            lines.push(`You are in a direct message with @${actor.username} (user id: ${actor.id}, dm channel id: ${channel.id})`);
        } else {
            lines.push(`Target channel: ${channel.name ? '#' + channel.name : 'DM'} (id: ${channel.id})`);
        }
    }

    if (trigger && trigger !== 'message') {
        lines.push('');
        if (trigger === 'cron') {
            lines.push('This turn was triggered by a scheduled cron task (no live user). Respond as if completing the scheduled task.');
        } else if (trigger === 'slash_command') {
            lines.push('This turn was triggered by a slash command.');
        } else {
            lines.push(`This turn was triggered by: ${trigger}`);
        }
    }

    return lines.join('\n');
};

const loadAvailableChannels = (client) => {
    if (!client?.guilds?.cache) return '';

    const guilds = [...client.guilds.cache.values()];
    if (guilds.length === 0) return '';

    const lines = [
        '=== AVAILABLE CHANNELS ===',
        'Channels this bot can currently see across all servers. Reference these by id when you need to target a specific channel.'
    ];

    for (const guild of guilds) {
        const textChannels = [...guild.channels.cache.values()]
            .filter(c => typeof c.isTextBased === 'function' && c.isTextBased());
        if (textChannels.length === 0) continue;
        lines.push('');
        lines.push(`Server: ${guild.name} (id: ${guild.id})`);
        for (const ch of textChannels) {
            lines.push(`  - #${ch.name} (id: ${ch.id})`);
        }
    }

    return lines.join('\n');
};

/**
 * agent.md
 * soul.md
 * user.md
 * memory.md
 * recent session diaries
 * runtime context (current channel/server/user, time, host, model)
 * available channels (live discord cache)
 */
const buildSystemInstruction = (turnContext = {}) => {
    const sections = [
        loadAgentIdentity(),
        loadAvailableSkills(),
        loadSoul(),
        loadUser(),
        loadLongTermMemory(),
        loadRecentSessionDiaries(2),
        loadRuntimeContext(turnContext),
        loadAvailableChannels(turnContext.client),
    ].filter(Boolean);

    const instruction = sections.join('\n\n');

    try {
        fs.writeFileSync(path.join(getWorkspacePath(), '.latest_context'), instruction);
    } catch { /* best-effort debug dump */ }

    return instruction;
};

module.exports = { buildSystemInstruction };
