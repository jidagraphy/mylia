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
            // - A user message
            // - An assistant message that did NOT call tools
            // Never break at: tool responses or assistant tool_call messages (they'd be orphaned)
            const isSafeBoundary = firstMsg.role === 'user' || (firstMsg.role === 'assistant' && !firstMsg.tool_calls);

            if (isSafeBoundary) {
                break; // Stop adding older messages at a coherent boundary
            }
        }
    }

    return sanitizeHistory(windowedHistory);
};

/**
 * Removes incomplete tool-call sequences from anywhere in the history.
 * An assistant message with tool_calls MUST be followed by the corresponding tool responses.
 * If not, the entire orphaned sequence is removed.
 */
const sanitizeHistory = (messages) => {
    const clean = [];

    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];

        if (msg.role === 'assistant' && msg.tool_calls?.length > 0) {
            // Check if the next messages are the matching tool responses
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
                // Keep the assistant + all its tool responses
                clean.push(msg);
                for (let j = 0; j < expectedCount; j++) {
                    clean.push(messages[i + 1 + j]);
                }
                i += expectedCount; // Skip past the tool responses
            }
            // else: skip this assistant message entirely (orphaned)
        } else if (msg.role === 'tool') {
            // Orphaned tool response without a preceding assistant tool_call — skip
            continue;
        } else {
            clean.push(msg);
        }
    }

    return clean;
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
