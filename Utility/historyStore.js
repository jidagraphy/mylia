const fs = require('fs');
const path = require('path');
const { getSessionFilename } = require('./sessionManager');
const { getWorkspacePath } = require('./workspaceSetup');

const chatHistoryDir = path.join(getWorkspacePath(), 'Sessions');

const getHistoryPath = () => path.join(chatHistoryDir, getSessionFilename());
const ensureDir = () => {
    if (!fs.existsSync(chatHistoryDir)) {
        fs.mkdirSync(chatHistoryDir, { recursive: true });
    }
};

const appendToHistory = (message) => {
    ensureDir();
    try {
        const entry = { ...message, timestamp: new Date().toISOString() };
        fs.appendFileSync(getHistoryPath(), JSON.stringify(entry) + '\n');
    } catch (error) {
        console.error('Failed to append to history:', error);
    }
};

const getSessionHistory = () => {
    const filePath = getHistoryPath();
    if (!fs.existsSync(filePath)) return [];

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

const getSessionHistoryByTokens = (maxTokens = 4000) => {
    const fullHistory = getSessionHistory();
    if (fullHistory.length === 0) return [];

    let currentTokens = 0;
    const windowedHistory = [];

    for (let i = fullHistory.length - 1; i >= 0; i--) {
        const msg = fullHistory[i];

        const contentStr = msg.content || '';
        const toolStr = msg.tool_calls ? JSON.stringify(msg.tool_calls) : '';
        const msgTokens = estimateTokens(contentStr) + estimateTokens(toolStr) + 10;

        currentTokens += msgTokens;
        windowedHistory.unshift(msg);

        if (currentTokens > maxTokens && windowedHistory.length > 0) {
            const firstMsg = windowedHistory[0];
            const isSafeBoundary = firstMsg.role === 'user' || (firstMsg.role === 'assistant' && !firstMsg.tool_calls);
            if (isSafeBoundary) {
                break;
            }
        }
    }

    return sanitizeHistory(windowedHistory);
};

/**
 * Removes incomplete tool-call sequences from anywhere in the history.
 */
const sanitizeHistory = (messages) => {
    const clean = [];

    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];

        if (msg.role === 'assistant' && msg.tool_calls?.length > 0) {
            const expectedCount = msg.tool_calls.length;
            let hasAllResponses = true;

            for (let j = 0; j < expectedCount; j++) {
                const next = messages[i + 1 + j];
                if (!next || next.role !== 'tool') {
                    hasAllResponses = false;
                    break;
                }
            }

            if (hasAllResponses) {
                clean.push(msg);
                for (let j = 0; j < expectedCount; j++) {
                    clean.push(messages[i + 1 + j]);
                }
                i += expectedCount;
            }
        } else if (msg.role === 'tool') {
            continue;
        } else {
            clean.push(msg);
        }
    }

    return clean;
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
