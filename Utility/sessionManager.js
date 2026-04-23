const fs = require('fs');
const path = require('path');

const { getWorkspacePath } = require('./workspaceSetup');

const chatHistoryDir = path.join(getWorkspacePath(), 'Sessions');
const INACTIVE_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours — safety fallback; primary compaction is agent-driven via compact_history

// Map<contextKey, { sessionId, lastActivityTime }>
const sessions = new Map();

const ensureDir = () => {
    if (!fs.existsSync(chatHistoryDir)) {
        fs.mkdirSync(chatHistoryDir, { recursive: true });
    }
};

const getContextKey = (channel, actor) => {
    if (channel?.guild) return channel.id;
    if (actor) return actor.id;
    return channel?.id || 'default';
};

const getTodayDate = () => new Date().toISOString().split('T')[0];

const getNextSessionNumber = (date, contextKey) => {
    ensureDir();
    const prefix = `${date}_`;
    const suffix = `_${contextKey}.jsonl`;
    const nums = fs.readdirSync(chatHistoryDir)
        .filter(f => f.startsWith(prefix) && f.endsWith(suffix))
        .map(f => parseInt(f.slice(prefix.length, prefix.length + 3), 10))
        .filter(n => Number.isFinite(n));
    return (nums.length ? Math.max(...nums) : 0) + 1;
};

const generateSessionId = (contextKey) => {
    const date = getTodayDate();
    const num = getNextSessionNumber(date, contextKey);
    return `${date}_${String(num).padStart(3, '0')}_${contextKey}`;
};

const findLatestSession = (contextKey) => {
    ensureDir();
    const suffix = `_${contextKey}.jsonl`;
    const files = fs.readdirSync(chatHistoryDir).filter(f => f.endsWith(suffix));
    if (files.length === 0) return null;

    files.sort((a, b) => {
        return fs.statSync(path.join(chatHistoryDir, b)).mtimeMs - fs.statSync(path.join(chatHistoryDir, a)).mtimeMs;
    });

    const latestFile = files[0];
    const mtimeMs = fs.statSync(path.join(chatHistoryDir, latestFile)).mtimeMs;
    return {
        id: latestFile.replace('.jsonl', ''),
        mtimeMs
    };
};

const initSession = (contextKey) => {
    const latest = findLatestSession(contextKey);
    if (latest) {
        sessions.set(contextKey, { sessionId: latest.id, lastActivityTime: latest.mtimeMs });
        console.log(`[Session] Resumed session for ${contextKey}: ${latest.id}`);
    }
};

const ensureSession = (contextKey) => {
    if (!sessions.has(contextKey)) {
        initSession(contextKey);
    }
};

const startSession = (contextKey) => {
    const sessionId = generateSessionId(contextKey);
    sessions.set(contextKey, { sessionId, lastActivityTime: Date.now() });
    console.log(`[Session] New session started for ${contextKey}: ${sessionId}`);
    return sessionId;
};

const getSessionId = (contextKey) => {
    ensureSession(contextKey);
    return sessions.get(contextKey)?.sessionId || null;
};

const getSessionFilename = (contextKey) => {
    const id = getSessionId(contextKey);
    return id ? `${id}.jsonl` : null;
};

const touch = (contextKey) => {
    const entry = sessions.get(contextKey);
    if (entry) entry.lastActivityTime = Date.now();
};

const isInactive = (contextKey) => {
    const entry = sessions.get(contextKey);
    if (!entry?.lastActivityTime) return true;
    return (Date.now() - entry.lastActivityTime) > INACTIVE_TIMEOUT;
};

const checkAndRenewSession = async (contextKey, onEndSession, { force = false } = {}) => {
    ensureSession(contextKey);
    const currentId = sessions.get(contextKey)?.sessionId || null;

    if (!currentId || isInactive(contextKey) || force) {
        const previousSessionId = currentId;
        if (previousSessionId && onEndSession) {
            const memoryDir = path.join(getWorkspacePath(), 'Memory');
            const diaryPath = path.join(memoryDir, `${previousSessionId}.md`);
            if (!fs.existsSync(diaryPath)) {
                await onEndSession(previousSessionId);
            }
        }
        startSession(contextKey);
        return { renewed: true, previousSessionId };
    }
    touch(contextKey);
    return { renewed: false, previousSessionId: null };
};

module.exports = {
    getContextKey,
    startSession,
    checkAndRenewSession,
    getSessionId,
    getSessionFilename,
    touch,
    getTodayDate,
};
