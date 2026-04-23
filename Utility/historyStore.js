const fs = require('fs');
const path = require('path');
const { getSessionFilename } = require('./sessionManager');
const { getWorkspacePath } = require('./workspaceSetup');

const chatHistoryDir = path.join(getWorkspacePath(), 'Sessions');
const TOOL_RESULT_REPLAY_MAX = 15000;
const HISTORY_CHAR_BUDGET = 50000;

const getHistoryPath = (contextKey) => {
    const filename = getSessionFilename(contextKey);
    if (!filename) return null;
    return path.join(chatHistoryDir, filename);
};
const ensureDir = () => {
    if (!fs.existsSync(chatHistoryDir)) {
        fs.mkdirSync(chatHistoryDir, { recursive: true });
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
        console.error('Failed to append to history:', error);
    }
};

const getSessionHistory = (contextKey) => {
    const filePath = getHistoryPath(contextKey);
    if (!filePath || !fs.existsSync(filePath)) return [];

    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const lines = data.split('\n').filter(line => line.trim() !== '');
        return lines.map(line => JSON.parse(line));
    } catch (error) {
        console.error('Failed to read session history:', error);
        return [];
    }
};

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
        chars += contentStr.length + toolStr.length + 10;
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

const getSessionHistoryByChars = (maxChars = 30000, contextKey) => {
    const fullHistory = getSessionHistory(contextKey);
    if (fullHistory.length === 0) return [];

    const sessionFilePath = getHistoryPath(contextKey);
    const replayHistory = truncateOversizedToolResults(fullHistory, sessionFilePath);

    const groups = groupMessages(replayHistory);
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
    const fullHistory = getSessionHistory(contextKey);
    if (fullHistory.length === 0) return 0;
    const sessionFilePath = getHistoryPath(contextKey);
    const replayHistory = truncateOversizedToolResults(fullHistory, sessionFilePath);
    const groups = groupMessages(replayHistory);
    let total = 0;
    for (const group of groups) total += groupCharLength(group);
    return total;
};

const getFullHistory = (sessionId) => {
    const filePath = path.join(chatHistoryDir, `${sessionId}.jsonl`);
    if (!fs.existsSync(filePath)) return [];

    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const lines = data.split('\n').filter(line => line.trim() !== '');
        return lines.map(line => JSON.parse(line));
    } catch (error) {
        console.error(`Failed to read full history for ${sessionId}:`, error);
        return [];
    }
};

module.exports = {
    appendToHistory,
    getSessionHistory,
    getSessionHistoryByChars,
    getReplaySize,
    getFullHistory,
    HISTORY_CHAR_BUDGET,
};
