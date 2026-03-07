const fs = require('fs');
const path = require('path');
const { complete } = require('../Clients/provider');
const { getFullHistory } = require('../Utility/historyStore');
const { getSessionId, startSession } = require('../Utility/sessionManager');

const { getWorkspacePath } = require('../Utility/workspace');

const memoryDir = path.join(getWorkspacePath(), 'Memory');

const ensureMemoryDir = () => {
    if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });
};
const readSessionDiary = (sessionId) => {
    const filePath = path.join(memoryDir, `${sessionId}.md`);
    if (!fs.existsSync(filePath)) return '';
    try { return fs.readFileSync(filePath, 'utf8').trim(); }
    catch { return ''; }
};

const generateSessionDiary = async (sessionId) => {
    const messages = getFullHistory(sessionId);

    if (messages.length === 0) return `Session ${sessionId} has no history to summarize.`;

    const historyText = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => `[${m.timestamp || ''}] [${m.role}]: ${m.content}`)
        .join('\n');

    const prompt = `Below is the transcript from session ${sessionId}:\n${historyText}\n\nWrite a brief session log summarizing this chat with Jida.

    Constraints:
    - Keep it short to about 3 paragraphs max.
    - Capture the general vibe and the main topics we talked about.`;

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

const handler = async () => {
    const currentSessionId = getSessionId();
    if (!currentSessionId) return 'No active session to compact.';

    const resultMessage = await generateSessionDiary(currentSessionId);
    startSession();

    return resultMessage;
};

const declaration = {
    type: "function",
    function: {
        name: "compactHistory",
        description: "Compacts today's conversation into a daily summary (Memory/YYYY-MM-DD.md). Use when asked for compaction or when conversation is long.",
        parameters: {
            type: "object",
            properties: {},
            required: []
        }
    }
};

module.exports = { handler, declaration, generateSessionDiary };
