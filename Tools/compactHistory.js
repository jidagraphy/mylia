const fs = require('fs');
const path = require('path');
const { complete } = require('../Clients/provider');
const { getFullHistory } = require('../Utility/historyStore');
const { checkAndRenewSession } = require('../Utility/sessionManager');

const memoryDir = path.resolve(__dirname, '../Agent/Memory');

/**
 * Ensures the Memory directory exists.
 */
const ensureMemoryDir = () => {
    if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });
};

/**
 * Reads a session diary if it exists.
 * @param {string} sessionId - YYYY-MM-DD_NNN
 * @returns {string}
 */
const readSessionDiary = (sessionId) => {
    const filePath = path.join(memoryDir, `${sessionId}.md`);
    if (!fs.existsSync(filePath)) return '';
    try { return fs.readFileSync(filePath, 'utf8').trim(); }
    catch { return ''; }
};

/**
 * Summarizes a given session's history into a session diary.
 * @param {string} sessionId
 * @returns {Promise<string>} Status message.
 */
const generateSessionDiary = async (sessionId) => {
    const messages = getFullHistory(sessionId);

    if (messages.length === 0) return `Session ${sessionId} has no history to summarize.`;

    const historyText = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => `[${m.timestamp || ''}] [${m.role}]: ${m.content}`)
        .join('\n');

    const prompt = `Below is the conversation from session ${sessionId}:\n${historyText}\n\nWrite a brief session diary as bullet points. Include only: key decisions, action items, and important facts. Do not paraphrase the conversation. Be concise.`;

    try {
        const summary = await complete(prompt);
        if (!summary) return 'Failed to generate session diary.';

        ensureMemoryDir();
        fs.writeFileSync(path.join(memoryDir, `${sessionId}.md`), summary);
        console.log(`[Session Diary] Saved session diary to Memory/${sessionId}.md`);
        return `Session diary saved to Memory/${sessionId}.md`;
    } catch (error) {
        console.error('[Session Diary] Failed:', error.message);
        return `Failed to generate diary: ${error.message}`;
    }
};

/**
 * Compacts today's chat history into a daily summary.
 * @returns {Promise<string>}
 */
const handler = async () => {
    let resultMessage = '';
    await checkAndRenewSession(async (oldSessionId) => {
        resultMessage = await generateSessionDiary(oldSessionId);
    });
    return resultMessage || 'Session renewed and diary generated.';
};

const declaration = {
    name: "compactHistory",
    description: "Compacts today's conversation into a daily summary (Memory/YYYY-MM-DD.md). Use when asked for compaction or when conversation is long.",
    parameters: {
        type: "OBJECT",
        properties: {},
        required: []
    }
};

module.exports = { handler, declaration, generateSessionDiary };
