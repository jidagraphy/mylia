const fs = require('fs');
const path = require('path');
const { getSessionFilename } = require('./sessionManager');

const chatHistoryDir = path.resolve(__dirname, '../Agent/Sessions');

/**
 * Returns the file path for the current session's chat history.
 */
const getHistoryPath = () => path.join(chatHistoryDir, getSessionFilename());

/**
 * Ensures the Sessions directory exists.
 */
const ensureDir = () => {
    if (!fs.existsSync(chatHistoryDir)) {
        fs.mkdirSync(chatHistoryDir, { recursive: true });
    }
};

/**
 * Appends a message to the current session's chat history with a timestamp.
 * @param {Object} message - { role, content, ... }
 */
const appendToHistory = (message) => {
    ensureDir();
    try {
        const entry = { ...message, timestamp: new Date().toISOString() };
        fs.appendFileSync(getHistoryPath(), JSON.stringify(entry) + '\n');
    } catch (error) {
        console.error('Failed to append to history:', error);
    }
};

/**
 * Reads all messages from the current session's history.
 * @returns {Array} Array of message objects.
 */
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

/**
 * Rough token estimator (1 token ≈ 2 characters for mixed Korean/English).
 */
const estimateTokens = (text) => {
    if (!text) return 0;
    return Math.ceil(text.length / 2);
};

/**
 * Reads the current session history and limits it to approximately maxTokens.
 * Keeps the most recent messages.
 * @param {number} maxTokens - Maximum allowed tokens (default 4000).
 * @returns {Array} Sliding window of recent message objects.
 */
const getSessionHistoryByTokens = (maxTokens = 4000) => {
    const fullHistory = getSessionHistory();
    if (fullHistory.length === 0) return [];

    let currentTokens = 0;
    const windowedHistory = [];

    // Traverse backwards to keep the most recent messages
    for (let i = fullHistory.length - 1; i >= 0; i--) {
        const msg = fullHistory[i];

        // Count stringified properties to match actual context usage closely
        const contentStr = msg.content || '';
        // If it's a tool call, stringify the tool_calls. If it's a tool result, just use content.
        const toolStr = msg.tool_calls ? JSON.stringify(msg.tool_calls) : '';
        const msgTokens = estimateTokens(contentStr) + estimateTokens(toolStr) + 10; // +10 for structural overhead

        currentTokens += msgTokens;
        windowedHistory.unshift(msg); // Add to the front since we are going backwards

        if (currentTokens > maxTokens && windowedHistory.length > 0) {
            const firstMsg = windowedHistory[0];
            // Safe boundaries to start a conversation snippet:
            // 1. A user message
            // 2. An assistant message that did NOT call tools
            const isSafeBoundary = firstMsg.role === 'user' || (firstMsg.role === 'assistant' && !firstMsg.tool_calls);

            if (isSafeBoundary) {
                break; // Stop adding older messages at a coherent boundary
            }
        }
    }

    return windowedHistory;
};

/**
 * Reads ALL messages from a specific session ID's history.
 * @param {string} sessionId - The session ID.
 * @returns {Array} Array of message objects.
 */
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
