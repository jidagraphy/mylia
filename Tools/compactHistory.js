const fs = require('fs');
const path = require('path');
const { complete } = require('../Clients/provider');
const { getFullHistory } = require('../Utility/historyStore');
const { getSessionId, startSession } = require('../Utility/sessionManager');

const { getWorkspacePath } = require('../Utility/workspaceSetup');

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

    const prompt = `Below is the transcript from session ${sessionId}:\n${historyText}\n\nWrite a session diary as concise bullet points. This will be read by the AI assistant at the start of future sessions as context, so write it as factual reference notes — not narrative, not in first person.

Include:
- What the user asked for or talked about
- Decisions made or preferences expressed
- Anything unresolved or left for next time
- Key facts learned about the user
- The general mood and any casual/fun moments

Skip verbose tool outputs and anything already saved to memory.md or user.md. Aim for 5-10 bullet points max.`;

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
        name: "compact_history",
        description: "Compacts the current session into a summary (Memory/YYYY-MM-DD_NNN.md). Use when asked for compaction or when conversation is long.",
        parameters: {
            type: "object",
            properties: {},
            required: []
        }
    }
};

module.exports = { handler, declaration, generateSessionDiary };
