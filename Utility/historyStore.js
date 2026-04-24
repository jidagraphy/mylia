const fs = require('fs');
const path = require('path');
const { getSessionFilename } = require('./sessionManager');
const { getWorkspacePath } = require('./workspaceSetup');
const { error: logError } = require('./logger');

const chatHistoryDir = path.join(getWorkspacePath(), 'Sessions');
const TOOL_RESULT_REPLAY_MAX = 15000;
const HISTORY_CHAR_BUDGET = 50000;
const JSON_FRAMING_OVERHEAD = 10;

const ensureDir = () => {
    if (!fs.existsSync(chatHistoryDir)) {
        fs.mkdirSync(chatHistoryDir, { recursive: true });
    }
};

const pathForSessionId = (sessionId) => path.join(chatHistoryDir, `${sessionId}.jsonl`);

const getHistoryPath = (contextKey) => {
    const filename = getSessionFilename(contextKey);
    return filename ? path.join(chatHistoryDir, filename) : null;
};

const readJsonl = (filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return [];
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return data.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
    } catch (error) {
        logError('History', `Failed to read JSONL ${filePath}: ${error.message}`);
        return [];
    }
};

const appendToHistory = (message, contextKey) => {
    ensureDir();
    const filePath = getHistoryPath(contextKey);
    if (!filePath) return;
    try {
        const entry = { ...message, timestamp: new Date().toISOString() };
        fs.appendFileSync(filePath, JSON.stringify(entry) + '\n');
    } catch (error) {
        logError('History', `Failed to append to history: ${error.message}`);
    }
};

const getSessionHistory = (contextKey) => readJsonl(getHistoryPath(contextKey));

const getFullHistory = (sessionId) => readJsonl(pathForSessionId(sessionId));

/**
 * Groups messages into atomic units. Tool-call sequences
 * (assistant w/ tool_calls + its tool results + follow-up assistant)
 * are grouped together so they're never split.
 */
const groupMessages = (messages) => {
    const groups = [];
    let i = 0;

    while (i < messages.length) {
        const msg = messages[i];

        if (msg.role === 'assistant' && msg.tool_calls?.length > 0) {
            const group = [msg];
            const expectedTools = msg.tool_calls.length;
            let j = 0;

            // grab the matching tool results
            while (j < expectedTools && i + 1 + j < messages.length) {
                const next = messages[i + 1 + j];
                if (next.role !== 'tool') break;
                group.push(next);
                j++;
            }

            // if we didn't get all tool results, skip this incomplete sequence
            if (j < expectedTools) {
                i += 1 + j;
                continue;
            }

            i += 1 + j;

            // grab the follow-up assistant response if it's next
            if (i < messages.length && messages[i].role === 'assistant' && !messages[i].tool_calls) {
                group.push(messages[i]);
                i++;
            }

            groups.push(group);
        } else if (msg.role === 'tool') {
            // orphan tool message, skip
            i++;
        } else {
            groups.push([msg]);
            i++;
        }
    }

    return groups;
};

const groupCharLength = (group) => {
    let chars = 0;
    for (const msg of group) {
        const contentStr = msg.content || '';
        const toolStr = msg.tool_calls ? JSON.stringify(msg.tool_calls) : '';
        chars += contentStr.length + toolStr.length + JSON_FRAMING_OVERHEAD;
    }
    return chars;
};

const truncateOversizedToolResults = (messages, sessionFilePath) => {
    return messages.map((msg) => {
        if (msg.role !== 'tool') return msg;
        const content = msg.content || '';
        if (content.length <= TOOL_RESULT_REPLAY_MAX) return msg;
        const stub = `[tool result truncated on replay: ${content.length} chars. Raw result preserved in session log at ${sessionFilePath}, tool_call_id "${msg.tool_call_id}".]`;
        return { ...msg, content: stub };
    });
};

const formatShortLocal = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Currently unused — see buildReplayGroups. Kept around in case we want to revisit
// with a non-prefix format (e.g. trailing "— sent HH:MM") that doesn't trigger
// the model into mirroring the pattern on its own replies.
const prefixTimestamps = (messages) => {
    return messages.map((msg) => {
        if (msg.role !== 'user') return msg;
        if (!msg.timestamp || !msg.content) return msg;
        const ts = formatShortLocal(msg.timestamp);
        if (!ts) return msg;
        return { ...msg, content: `[${ts}] ${msg.content}` };
    });
};

const buildReplayGroups = (contextKey) => {
    const fullHistory = getSessionHistory(contextKey);
    if (fullHistory.length === 0) return [];
    const sessionFilePath = getHistoryPath(contextKey);
    // prefixTimestamps disabled: even when limited to user messages only, the model pattern-imitates
    // the `[MM-DD HH:MM]` shape and starts emitting the same prefix on its own replies.
    // The system prompt's "Current time" line already gives the model absolute time awareness.
    // const processed = prefixTimestamps(truncateOversizedToolResults(fullHistory, sessionFilePath));
    const processed = truncateOversizedToolResults(fullHistory, sessionFilePath);
    return groupMessages(processed);
};

const getSessionHistoryByChars = (maxChars = 30000, contextKey) => {
    const groups = buildReplayGroups(contextKey);
    if (groups.length === 0) return [];

    let currentChars = 0;
    const selectedGroups = [];
    for (let i = groups.length - 1; i >= 0; i--) {
        const groupChars = groupCharLength(groups[i]);
        if (currentChars + groupChars > maxChars) break;
        currentChars += groupChars;
        selectedGroups.unshift(groups[i]);
    }
    return selectedGroups.flat();
};

const getReplaySize = (contextKey) => {
    const groups = buildReplayGroups(contextKey);
    let total = 0;
    for (const group of groups) total += groupCharLength(group);
    return total;
};

const getLastUserMessageTimestamp = (contextKey) => {
    const history = getSessionHistory(contextKey);
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].role === 'user' && history[i].timestamp) {
            return history[i].timestamp;
        }
    }
    return null;
};

module.exports = {
    appendToHistory,
    getSessionHistory,
    getSessionHistoryByChars,
    getReplaySize,
    getFullHistory,
    getLastUserMessageTimestamp,
    HISTORY_CHAR_BUDGET,
};
