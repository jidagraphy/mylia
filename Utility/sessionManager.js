const fs = require('fs');
const path = require('path');

const { getWorkspacePath } = require('./workspace');

const chatHistoryDir = path.join(getWorkspacePath(), 'Sessions');
const INACTIVE_TIMEOUT = 60 * 60 * 1000; // 1 hour

let sessionId = null;
let lastActivityTime = null;
const ensureDir = () => {
    if (!fs.existsSync(chatHistoryDir)) {
        fs.mkdirSync(chatHistoryDir, { recursive: true });
    }
};

//session works by checking if the last session is inactive, if so, it creates a new session
//inactive if last message is older than INACTIVE_TIMEOUT


const initSession = () => {
    const latest = findLatestSession();
    if (latest) {
        sessionId = latest.id;
        lastActivityTime = latest.mtimeMs;
        console.log(`[Session] Found latest session: ${sessionId} (last active: ${new Date(lastActivityTime).toISOString()})`);
    } else {
        console.log(`[Session] No existing sessions found.`);
    }
};

const findLatestSession = () => {
    ensureDir();
    const files = fs.readdirSync(chatHistoryDir).filter(f => f.endsWith('.jsonl'));
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

initSession();
const getTodayDate = () => new Date().toISOString().split('T')[0];

const getNextSessionNumber = (date) => {
    ensureDir();
    const files = fs.readdirSync(chatHistoryDir)
        .filter(f => f.startsWith(date) && f.endsWith('.jsonl'));
    return files.length + 1;
};

const generateSessionId = () => {
    const date = getTodayDate();
    const num = getNextSessionNumber(date);
    return `${date}_${String(num).padStart(3, '0')}`;
};

const startSession = () => {
    sessionId = generateSessionId();
    lastActivityTime = Date.now();
    console.log(`[Session] New session started: ${sessionId}`);
    return sessionId;
};

const getSessionId = () => sessionId;

const getSessionFilename = () => `${sessionId}.jsonl`;

const touch = () => {
    lastActivityTime = Date.now();
};


const isInactive = () => {
    if (!lastActivityTime) return true;
    return (Date.now() - lastActivityTime) > INACTIVE_TIMEOUT;
};

const checkAndRenewSession = async (onEndSession) => {
    if (!sessionId || isInactive()) {
        const previousSessionId = sessionId;
        if (previousSessionId && onEndSession) {
            // Check if diary already exists to avoid redundant generation from restarts
            const memoryDir = path.join(getWorkspacePath(), 'Memory');
            const diaryPath = path.join(memoryDir, `${previousSessionId}.md`);
            if (!fs.existsSync(diaryPath)) {
                await onEndSession(previousSessionId);
            }
        }
        startSession();
        return { renewed: true, previousSessionId };
    }
    touch();
    return { renewed: false, previousSessionId: null };
};

module.exports = {
    startSession,
    checkAndRenewSession,
    getSessionId,
    getSessionFilename,
    touch,
    getTodayDate,
};
