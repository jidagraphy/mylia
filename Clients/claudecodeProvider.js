const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getConfig } = require('../Utility/config');
const { getWorkspacePath } = require('../Utility/workspaceSetup');
const { CATEGORIES } = require('../Utility/errorMessages');

// Runs each turn through the official `claude` CLI in headless mode (`claude -p`).
// Claude Code runs its own tools and keeps its own conversation (--resume), so this provider
// sends only the newest user message, ignores Mylia's tool list, and never returns tool_calls.

const DEFAULT_TIMEOUT_SECONDS = 600;
const sessionMapFile = path.join(getWorkspacePath(), 'claude_sessions.json');
const attachmentsDir = path.join(getWorkspacePath(), '.attachments');

// Mylia session id → Claude Code session id. Keyed by Mylia's session (not channel), so /new and
// the inactivity renewal start a fresh Claude session on their own.
// ponytail: never pruned; one short line per session.
const readSessionMap = () => {
    try { return JSON.parse(fs.readFileSync(sessionMapFile, 'utf8')); }
    catch { return {}; }
};

const saveClaudeSessionId = (myliaSessionId, claudeSessionId) => {
    const sessionMap = readSessionMap();
    if (sessionMap[myliaSessionId] === claudeSessionId) return;
    sessionMap[myliaSessionId] = claudeSessionId;
    fs.writeFileSync(sessionMapFile, JSON.stringify(sessionMap, null, 2));
};

const forgetClaudeSessionId = (myliaSessionId) => {
    const sessionMap = readSessionMap();
    delete sessionMap[myliaSessionId];
    fs.writeFileSync(sessionMapFile, JSON.stringify(sessionMap, null, 2));
};

// A parent Claude Code session (e.g. testing Mylia from inside one) leaks CLAUDE* variables that
// make the child try the parent's auth and fail. Keep only CLAUDE_CONFIG_DIR.
const buildChildEnvironment = () => Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('CLAUDE') || key === 'CLAUDE_CONFIG_DIR')
);

// Discord images become files Claude can open with its Read tool.
const saveImagesForClaude = (images = []) => images.map((image, index) => {
    fs.mkdirSync(attachmentsDir, { recursive: true });
    const extension = (image.mimeType?.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const filePath = path.join(attachmentsDir, `${Date.now()}_${index}.${extension}`);
    fs.writeFileSync(filePath, Buffer.from(image.data, 'base64'));
    return filePath;
});

/**
 * Spawns `claude -p` with the prompt on stdin (a prompt starting with "-" would otherwise parse as a flag)
 * and reads --output-format stream-json line by line.
 */
const runClaudeCode = ({ args, promptText, onToolCalls }) => new Promise((resolve) => {
    const config = getConfig() || {};
    const timeoutMs = (config.CLAUDE_CODE_TIMEOUT_SECONDS || DEFAULT_TIMEOUT_SECONDS) * 1000;
    const run = { resultEvent: null, stderrText: '', exitCode: null, timedOut: false, spawnError: null };

    // --setting-sources '': skip user/project settings, so the owner's own Claude Code setup
    // (global CLAUDE.md, hooks, plugins like a Discord channel) never leaks into the persona. Login is unaffected.
    // autoMemoryEnabled false: memory.md is the only memory; Claude Code's own memory folder would split it in two.
    const child = spawn(config.CLAUDE_CODE_BIN || 'claude', [
        '-p', '--output-format', 'stream-json', '--verbose',
        '--setting-sources', '',
        '--settings', JSON.stringify({ autoMemoryEnabled: false }),
        ...args,
    ], {
        cwd: getWorkspacePath(),
        env: buildChildEnvironment(),
    });

    const timeoutHandle = setTimeout(() => {
        run.timedOut = true;
        child.kill('SIGTERM');
    }, timeoutMs);

    let stdoutBuffer = '';
    const handleStreamLine = (line) => {
        if (!line.trim()) return;
        let streamEvent;
        try { streamEvent = JSON.parse(line); } catch { return; }
        if (streamEvent.type === 'result') run.resultEvent = streamEvent;
        if (streamEvent.type === 'assistant' && onToolCalls) {
            // Same shape as Mylia's own tool_calls, so agentRunner describes them the same way.
            const toolCalls = (streamEvent.message?.content || [])
                .filter(block => block.type === 'tool_use')
                .map(block => ({ function: { name: block.name, arguments: block.input || {} } }));
            if (toolCalls.length > 0) onToolCalls(toolCalls);
        }
    };

    child.stdout.on('data', (chunk) => {
        stdoutBuffer += chunk.toString();
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop();
        lines.forEach(handleStreamLine);
    });
    child.stderr.on('data', (chunk) => { run.stderrText += chunk.toString(); });
    child.on('error', (error) => { run.spawnError = error; });
    child.on('close', (exitCode) => {
        clearTimeout(timeoutHandle);
        handleStreamLine(stdoutBuffer);
        run.exitCode = exitCode;
        resolve(run);
    });

    child.stdin.on('error', () => { }); // child died before reading stdin; 'close' reports it
    child.stdin.end(promptText);
});

const classifyClaudeCodeError = (run) => {
    const { resultEvent, stderrText, exitCode, timedOut, spawnError } = run;
    if (spawnError) {
        return { category: CATEGORIES.UNKNOWN, detail: spawnError.code === 'ENOENT' ? '`claude` not found — install Claude Code or set CLAUDE_CODE_BIN' : spawnError.message };
    }
    if (timedOut) return { category: CATEGORIES.TIMEOUT, detail: 'claude -p timed out' };
    if (resultEvent && !resultEvent.is_error && exitCode === 0) return null;

    const detail = ((resultEvent?.is_error && resultEvent.result) || stderrText || `exit code ${exitCode}`).trim().slice(0, 300);
    const status = resultEvent?.api_error_status;
    if (status === 401 || status === 403 || /authenticat|log ?in|oauth/i.test(detail)) return { category: CATEGORIES.AUTH, detail };
    if (/usage limit|hit your limit|limit reached|quota/i.test(detail)) return { category: CATEGORIES.QUOTA, detail };
    if (status === 429 || /rate.?limit/i.test(detail)) return { category: CATEGORIES.RATE_LIMIT, detail };
    if (status === 404 || /model.*(not found|invalid|not available)/i.test(detail)) return { category: CATEGORIES.MODEL_NOT_FOUND, detail };
    if (status >= 500 || /overloaded/i.test(detail)) return { category: CATEGORIES.UPSTREAM, detail };
    return { category: CATEGORIES.UNKNOWN, detail };
};

/**
 * One full Claude Code turn. `messages` is only used for its last user message; Claude Code owns the history.
 */
const chat = async (model, systemInstruction, _tools, messages, turnOptions = {}) => {
    const { sessionId, resumeSession, onToolCalls } = turnOptions;
    const latestUserMessage = [...messages].reverse().find(message => message.role === 'user') || { content: '' };
    const imagePaths = saveImagesForClaude(latestUserMessage.images);
    const promptText = [
        latestUserMessage.content || '',
        ...imagePaths.map(imagePath => `[Attached image: ${imagePath}]`),
    ].join('\n\n');

    const keepsSession = Boolean(resumeSession && sessionId);
    const buildArgs = (claudeSessionId) => [
        ...(model ? ['--model', model] : []),
        // ponytail: auto mode hardcoded (a classifier vets risky actions); make configurable if a setup needs another mode.
        '--permission-mode', 'auto',
        '--append-system-prompt', systemInstruction,
        // Re-apply the system prompt on resume; by default the first turn's prompt is reused verbatim.
        '--system-prompt-snapshot', 'off',
        ...(claudeSessionId ? ['--resume', claudeSessionId] : []),
        ...(keepsSession ? [] : ['--no-session-persistence']),
    ];

    const previousClaudeSessionId = keepsSession ? readSessionMap()[sessionId] : null;
    let run = await runClaudeCode({ args: buildArgs(previousClaudeSessionId), promptText, onToolCalls });

    // Claude's session file is gone (cleaned up, other machine): start a fresh one instead of failing.
    if (previousClaudeSessionId && /no conversation found/i.test(`${run.stderrText}${run.resultEvent?.result || ''}`)) {
        forgetClaudeSessionId(sessionId);
        run = await runClaudeCode({ args: buildArgs(null), promptText, onToolCalls });
    }

    const response = { role: 'assistant', content: run.resultEvent?.result || '', tool_calls: [] };
    const error = classifyClaudeCodeError(run);
    if (error) {
        // Never retry: the failed run may already have executed shell commands or edited files.
        response.error = { ...error, retryable: false };
        response.content = '';
        return response;
    }

    if (keepsSession && run.resultEvent.session_id) saveClaudeSessionId(sessionId, run.resultEvent.session_id);
    return response;
};

/**
 * Plain text completion (session diaries, memory flush): no tools, no saved session,
 * and Claude Code's default system prompt replaced instead of appended to.
 */
const complete = async (model, prompt, systemPrompt) => {
    const run = await runClaudeCode({
        args: [
            ...(model ? ['--model', model] : []),
            '--tools', '',
            '--no-session-persistence',
            ...(systemPrompt ? ['--system-prompt', systemPrompt] : []),
        ],
        promptText: prompt,
    });
    const error = classifyClaudeCodeError(run);
    if (error) {
        console.error(`[ClaudeCodeProvider] Complete error: [${error.category}] ${error.detail}`);
        return '';
    }
    return run.resultEvent.result?.trim() || '';
};

/**
 * For `mylia start`: returns what's wrong with the local Claude Code setup, or null if it's ready.
 */
const describeClaudeCodeSetupProblem = () => {
    const claudeBin = getConfig()?.CLAUDE_CODE_BIN || 'claude';
    const authStatus = spawnSync(claudeBin, ['auth', 'status'], { env: buildChildEnvironment(), encoding: 'utf8' });
    if (authStatus.error?.code === 'ENOENT') return `\`${claudeBin}\` not found. Install Claude Code, or set CLAUDE_CODE_BIN in config.json to its full path.`;
    if (authStatus.status !== 0) return 'Claude Code is not logged in. Run `claude` once and log in.';
    return null;
};

module.exports = { chat, complete, describeClaudeCodeSetupProblem };
