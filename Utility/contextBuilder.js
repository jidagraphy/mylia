const fs = require('fs');
const os = require('os');
const path = require('path');
const { getWorkspacePath } = require('./workspaceSetup');
const { getInstalledSkills } = require('./skillManager');
const { getConfig } = require('./config');
const { getReplaySize, getLastUserMessageTimestamp, HISTORY_CHAR_BUDGET } = require('./historyStore');

const ADVISORY_THRESHOLD_RATIO = 0.7;
const ADVISORY_THRESHOLD = HISTORY_CHAR_BUDGET * ADVISORY_THRESHOLD_RATIO;

const agentMdPath = path.join(getWorkspacePath(), 'agent.md');
const soulFile = path.join(getWorkspacePath(), 'soul.md');
const userFile = path.join(getWorkspacePath(), 'user.md');
const memoryFile = path.join(getWorkspacePath(), 'memory.md');
const memoryDir = path.join(getWorkspacePath(), 'Memory');

const loadAgentIdentity = () => `=== AGENT ===\n${fs.readFileSync(agentMdPath, 'utf-8').trim()}`;

const loadOptionalSection = (filePath, header) => {
    try {
        const body = fs.readFileSync(filePath, 'utf8').trim();
        return body ? `=== ${header} ===\n${body}` : '';
    } catch {
        return '';
    }
};

const loadRecentSessionDiaries = (count = 2, contextKey = null) => {
    if (!fs.existsSync(memoryDir)) return '';

    const suffix = contextKey ? `_${contextKey}.md` : '.md';
    const files = fs.readdirSync(memoryDir)
        .filter(f => f.endsWith(suffix))
        .sort((a, b) => b.localeCompare(a))
        .slice(0, count)
        .reverse();

    if (files.length === 0) return '';

    let diaries = '';
    for (const file of files) {
        const sessionId = file.replace('.md', '');
        const filePath = path.join(memoryDir, `${sessionId}.md`);
        let diaryContent;
        try { diaryContent = fs.readFileSync(filePath, 'utf8').trim(); }
        catch { continue; }
        if (diaryContent) {
            diaries += `\n\n## Session Diary (${sessionId})\n${diaryContent}`;
        }
    }

    if (diaries) {
        return `=== RECENT SESSION DIARIES ===${diaries}`;
    }
    return '';
};

const loadContextPressureAdvisory = (contextKey, trigger) => {
    if (!contextKey) return '';
    if (trigger === 'cron') return '';

    const replayChars = getReplaySize(contextKey);
    if (replayChars < ADVISORY_THRESHOLD) return '';

    const k = Math.round(replayChars / 1000);
    return `=== CONTEXT PRESSURE ===\nThis conversation has grown long (~${k}k chars of replay). At a convenient moment, let the user know and ask if they'd like to wrap up and save the chat. Only call \`compact_history\` if they agree.`;
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

const formatTimeSince = (iso) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    if (diffMs < 60_000) return 'less than a minute ago';
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
};

const loadRuntimeContext = (turnContext = {}) => {
    const { channel, client, actor, trigger, contextKey } = turnContext;
    const config = getConfig() || {};

    const lines = ['=== CURRENT CONTEXT ==='];

    const now = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    lines.push(`Current time: ${now.toLocaleString()} (${tz})`);

    if (contextKey) {
        const lastUserTs = getLastUserMessageTimestamp(contextKey);
        if (lastUserTs) {
            lines.push(`Last user message: ${formatTimeSince(lastUserTs)}`);
        }
    }

    lines.push(`Host: ${os.hostname()} — ${os.platform()} ${os.release()} (user: ${os.userInfo().username})`);

    if (config.AI_PROVIDER || config.AI_MODEL) {
        lines.push(`Model: ${config.AI_MODEL || 'unknown'} via ${config.AI_PROVIDER || 'unknown'}`);
    }

    if (contextKey) {
        const replayK = Math.round(getReplaySize(contextKey) / 1000);
        const budgetK = Math.round(HISTORY_CHAR_BUDGET / 1000);
        lines.push(`Replay: ~${replayK}k / ${budgetK}k chars of history budget`);
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
    const { contextKey, trigger } = turnContext;
    const sections = [
        loadAgentIdentity(),
        loadAvailableSkills(),
        loadOptionalSection(soulFile, 'SOUL'),
        loadOptionalSection(userFile, 'USER PROFILE'),
        loadOptionalSection(memoryFile, 'LONG-TERM MEMORY'),
        loadRecentSessionDiaries(2, contextKey),
        loadContextPressureAdvisory(contextKey, trigger),
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
