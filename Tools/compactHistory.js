const fs = require('fs');
const path = require('path');
const { complete } = require('../Clients/provider');
const { getFullHistory } = require('../Utility/historyStore');
const { getSessionId, checkAndRenewSession } = require('../Utility/sessionManager');

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

    const systemPrompt = `You are a session summarizer. Output ONLY bullet points. No headers, no preamble, no commentary, no reasoning. Start directly with "- ".`;

    const prompt = `Transcript from session ${sessionId}:
${historyText}

---

Summarize as 5-10 bullet points covering: user requests, decisions made, preferences expressed, unresolved items, key user facts, and general mood/fun moments. Skip tool output details. Write as factual third-person notes. Preserve exact names, paths, and identifiers.`;

    try {
        const summary = await complete(prompt, systemPrompt);
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

const handler = async ({ _contextKey } = {}) => {
    if (!_contextKey) return 'No context key available — cannot determine which session to compact.';
    const currentSessionId = getSessionId(_contextKey);
    if (!currentSessionId) return 'No active session to compact.';

    const resultMessage = await generateSessionDiary(currentSessionId);
    await checkAndRenewSession(_contextKey, generateSessionDiary, { force: true });

    return resultMessage;
};

const declaration = {
    type: "function",
    function: {
        name: "compact_history",
        description: "Archives the current session as a diary (Memory/YYYY-MM-DD_NNN.md) and starts a fresh session. Only call when the user has agreed to wrap up — either in response to a CONTEXT PRESSURE advisory, or when they directly ask to compact/save the chat.",
        parameters: {
            type: "object",
            properties: {},
            required: []
        }
    }
};

module.exports = { handler, declaration, generateSessionDiary };
