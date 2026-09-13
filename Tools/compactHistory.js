const fs = require('fs');
const path = require('path');
const { complete } = require('../Clients/provider');
const { getFullHistory } = require('../Utility/historyStore');
const { getSessionId, checkAndRenewSession } = require('../Utility/sessionManager');

const { getWorkspacePath } = require('../Utility/workspaceSetup');
const { log, error: logError } = require('../Utility/logger');
const { looseRegex } = require('../Utility/textMatch');

const memoryDir = path.join(getWorkspacePath(), 'Memory');
const MAX_FLUSH_FACTS = 3;

const readOrEmpty = (filePath) => {
    try { return fs.readFileSync(filePath, 'utf8'); }
    catch { return ''; }
};

// Memory flush: at session end, promote durable facts into memory.md so they don't depend on
// the model remembering to save mid-chat. Append-only, never rewrites the file.
// ponytail: no consolidation; memory.md grows ~200 chars/session. Add a cleanup pass if it gets large.
const flushDurableFacts = async (historyText) => {
    const memoryFile = path.join(getWorkspacePath(), 'memory.md');
    const memory = readOrEmpty(memoryFile);
    const user = readOrEmpty(path.join(getWorkspacePath(), 'user.md'));

    const systemPrompt = `You extract long-term facts. Output ONLY lines starting with "- ", or the single word NONE. No preamble, no commentary.`;
    const prompt = `ALREADY SAVED (memory.md):
${memory}

ALREADY SAVED (user.md):
${user}

TRANSCRIPT:
${historyText}

---

List new facts from the transcript worth remembering permanently: stable preferences, gear, ongoing projects, decisions, important people or dates. Skip anything already saved above, small talk, one-off tasks, and anything temporary. Never include passwords, API keys, tokens, or other secrets. At most ${MAX_FLUSH_FACTS} lines, one short fact per line, in the language the user used. If nothing qualifies, output NONE.`;

    const output = await complete(prompt, systemPrompt);
    const known = (memory + '\n' + user).normalize('NFC');
    const facts = (output || '').split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('- ') && line.length > 2)
        .filter(line => !looseRegex(line.slice(2), 'u')?.test(known))
        .slice(0, MAX_FLUSH_FACTS);
    if (facts.length === 0) return;

    const date = new Date().toLocaleDateString('sv-SE');
    const separator = memory === '' || memory.endsWith('\n') ? '' : '\n';
    fs.appendFileSync(memoryFile, separator + facts.map(f => `${f} (${date})`).join('\n') + '\n', 'utf8');
    log('Memory Flush', `Appended ${facts.length} fact(s) to memory.md:\n${facts.join('\n')}`);
};

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
        log('Session Diary', `Saved session diary to Memory/${sessionId}.md`);

        try { await flushDurableFacts(historyText); }
        catch (e) { logError('Memory Flush', `Failed: ${e.message}`); }

        return `Session diary saved to Memory/${sessionId}.md`;
    } catch (error) {
        logError('Session Diary', `Failed: ${error.message}`);
        return `Failed to generate diary: ${error.message}`;
    }
};

const handler = async (_args, { contextKey } = {}) => {
    if (!contextKey) return 'No context key available — cannot determine which session to compact.';
    const currentSessionId = getSessionId(contextKey);
    if (!currentSessionId) return 'No active session to compact.';

    const resultMessage = await generateSessionDiary(currentSessionId);
    await checkAndRenewSession(contextKey, generateSessionDiary, { force: true });

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
