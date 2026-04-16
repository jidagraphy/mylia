const fs = require('fs');
const path = require('path');
const { getSessionFilename } = require('./sessionManager');
const { getWorkspacePath } = require('./workspaceSetup');

const chatHistoryDir = path.join(getWorkspacePath(), 'Sessions');

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

const estimateTokens = (text) => {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
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

const estimateGroupTokens = (group) => {
    let tokens = 0;
    for (const msg of group) {
        const contentStr = msg.content || '';
        const toolStr = msg.tool_calls ? JSON.stringify(msg.tool_calls) : '';
        tokens += estimateTokens(contentStr) + estimateTokens(toolStr) + 10;
    }
    return tokens;
};

const getSessionHistoryByTokens = (maxTokens = 4000, contextKey) => {
    const fullHistory = getSessionHistory(contextKey);
    if (fullHistory.length === 0) return [];

    const groups = groupMessages(fullHistory);
    let currentTokens = 0;
    const selectedGroups = [];

    for (let i = groups.length - 1; i >= 0; i--) {
        const groupTokens = estimateGroupTokens(groups[i]);

        if (currentTokens + groupTokens > maxTokens) break;

        currentTokens += groupTokens;
        selectedGroups.unshift(groups[i]);
    }

    return selectedGroups.flat();
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
    getSessionHistoryByTokens,
    getFullHistory,
};
