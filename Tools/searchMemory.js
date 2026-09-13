const fs = require('fs');
const path = require('path');
const { getWorkspacePath } = require('../Utility/workspaceSetup');
const { getFullHistory } = require('../Utility/historyStore');
const { getSessionId } = require('../Utility/sessionManager');

// Output stays small on purpose: tool results are replayed in later turns and context is budgeted.
const MAX_RESULTS = 8;
const SNIPPET_CHARS = 200;

const localTime = (iso) => (iso ? new Date(iso).toLocaleString('sv-SE').slice(0, 16) : '?');

const makeSnippet = (text, terms) => {
    const flat = text.replace(/\s+/g, ' ').trim();
    const lower = flat.toLowerCase();
    const at = Math.min(...terms.map(t => lower.indexOf(t)).filter(i => i >= 0));
    const start = Math.max(0, at - 60);
    const end = start + SNIPPET_CHARS;
    return (start > 0 ? '…' : '') + flat.slice(start, end) + (end < flat.length ? '…' : '');
};

// ponytail: linear keyword scan of every diary + session file per call. Fine for thousands of files;
// switch to an index or embeddings if it gets slow or keyword recall is too weak.
const handler = async ({ query }, { contextKey } = {}) => {
    if (typeof query !== 'string' || !query.trim()) return 'Error: query is required.';

    const terms = [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))];
    const suffix = contextKey ? `_${contextKey}` : '';
    const currentSessionId = contextKey ? getSessionId(contextKey) : null;
    const ws = getWorkspacePath();
    const list = (dir, ext) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(`${suffix}${ext}`)) : []);

    const hits = [];
    const consider = (text, label, sortKey) => {
        if (!text) return;
        const lower = text.toLowerCase();
        const score = terms.filter(t => lower.includes(t)).length;
        if (score > 0) hits.push({ score, sortKey, label, text });
    };

    const memoryDir = path.join(ws, 'Memory');
    for (const file of list(memoryDir, '.md')) {
        const id = file.slice(0, -'.md'.length);
        for (const line of fs.readFileSync(path.join(memoryDir, file), 'utf8').split('\n')) {
            consider(line, `diary ${id.slice(0, 10)}`, id);
        }
    }

    // The current session is skipped: it's already in the replay, and it contains the question being asked.
    for (const file of list(path.join(ws, 'Sessions'), '.jsonl')) {
        const id = file.slice(0, -'.jsonl'.length);
        if (id === currentSessionId) continue;
        for (const m of getFullHistory(id)) {
            if ((m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') {
                consider(m.content, `chat ${localTime(m.timestamp)} ${m.role}`, m.timestamp || id);
            }
        }
    }

    if (hits.length === 0) return `No matches for "${query}" in past diaries or chats.`;

    hits.sort((a, b) => b.score - a.score || String(b.sortKey).localeCompare(String(a.sortKey)));
    const shown = hits.slice(0, MAX_RESULTS).map(h => `- [${h.label}] ${makeSnippet(h.text, terms)}`);
    const more = hits.length > MAX_RESULTS ? ` (showing top ${MAX_RESULTS})` : '';
    return `${hits.length} match${hits.length === 1 ? '' : 'es'} for "${query}"${more}:\n${shown.join('\n')}`;
};

const declaration = {
    type: "function",
    function: {
        name: "search_memory",
        description: "Searches past session diaries and earlier chat logs in this channel/DM (not the current session, not memory.md — those are already in your context). Use when the user refers to something from a previous conversation that you can't see. Returns short dated snippets, best matches first.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Keywords, space-separated. Matches any keyword; results with more keywords rank higher. Try synonyms or other languages if nothing is found."
                }
            },
            required: ["query"]
        }
    }
};

module.exports = { handler, declaration };
