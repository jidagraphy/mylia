const fs = require('fs');
const path = require('path');

const chatHistoryDir = path.resolve(__dirname, '../Agent/ChatHistory');
const INACTIVE_TIMEOUT = 60 * 60 * 1000; // 1 hour

let sessionId = null;
let lastActivityTime = null;

/**
 * Ensures the ChatHistory directory exists.
 */
const ensureDir = () => {
    if (!fs.existsSync(chatHistoryDir)) {
        fs.mkdirSync(chatHistoryDir, { recursive: true });
    }
};

/**
 * Finds the most recently modified session file.
 * @returns {{ id: string, mtimeMs: number } | null}
 */
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

/**
 * Initializes the session state on module load.
 */
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

// Auto-initialize
initSession();

/**
 * Returns today's date string as YYYY-MM-DD.
 */
const getTodayDate = () => new Date().toISOString().split('T')[0];

/**
 * Counts existing session files for a given date to determine next number.
 * @param {string} date - YYYY-MM-DD
 * @returns {number} Next session number (1-based).
 */
const getNextSessionNumber = (date) => {
    ensureDir();
    const files = fs.readdirSync(chatHistoryDir)
        .filter(f => f.startsWith(date) && f.endsWith('.jsonl'));
    return files.length + 1;
};

/**
 * Generates a session ID like "2026-03-02_001".
 * @returns {string}
 */
const generateSessionId = () => {
    const date = getTodayDate();
    const num = getNextSessionNumber(date);
    return `${date}_${String(num).padStart(3, '0')}`;
};

/**
 * Starts a new session. Returns the new session ID.
 * @returns {string} The new session ID.
 */
const startSession = () => {
    sessionId = generateSessionId();
    lastActivityTime = Date.now();
    console.log(`[Session] New session started: ${sessionId}`);
    return sessionId;
};

/**
 * Gets the current session ID.
 * @returns {string|null}
 */
const getSessionId = () => sessionId;

/**
 * Gets the JSONL filename for the current session.
 * @returns {string}
 */
const getSessionFilename = () => `${sessionId}.jsonl`;

/**
 * Updates the last activity timestamp.
 */
const touch = () => {
    lastActivityTime = Date.now();
};

/**
 * Checks if the session has been inactive longer than the timeout.
 * @returns {boolean}
 */
const isInactive = () => {
    if (!lastActivityTime) return true;
    return (Date.now() - lastActivityTime) > INACTIVE_TIMEOUT;
};

/**
 * Checks inactivity and renews session if needed.
 * Returns { renewed: boolean, previousSessionId: string|null }.
 * @param {Function} onEndSession - Async callback called with previous sessionId before renewal.
 * @returns {Promise<{ renewed: boolean, previousSessionId: string|null }>}
 */
const checkAndRenewSession = async (onEndSession) => {
    if (!sessionId || isInactive()) {
        const previousSessionId = sessionId;
        if (previousSessionId && onEndSession) {
            // Check if diary already exists to avoid redundant generation from restarts
            const memoryDir = path.resolve(__dirname, '../Agent/Memory');
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
