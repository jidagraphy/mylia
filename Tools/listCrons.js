const { CronExpressionParser } = require('cron-parser');
const { loadEntries } = require('../Utility/cronStore');

const handler = async () => {
    const entries = loadEntries();
    if (entries.length === 0) return 'No cron entries scheduled.';

    const now = new Date();
    const lines = [`${entries.length} cron entr${entries.length === 1 ? 'y' : 'ies'}:`];

    for (const e of entries) {
        let nextFire = 'n/a';
        if (e.type === 'at') {
            if (e.fired) {
                nextFire = `fired at ${e.lastFiredAt || '?'}`;
            } else {
                nextFire = new Date(e.schedule).toISOString();
            }
        } else if (e.type === 'cron') {
            try {
                const iter = CronExpressionParser.parse(e.schedule, {
                    currentDate: now,
                    tz: e.timezone || undefined,
                });
                nextFire = iter.next().toDate().toISOString();
            } catch {
                nextFire = 'invalid expression';
            }
        }

        const disabledTag = e.enabled === false ? ' [disabled]' : '';
        lines.push(
            `- ${e.id} [${e.type}]${disabledTag} "${e.schedule}"${e.timezone ? ` (${e.timezone})` : ''}\n` +
            `    channel: ${e.channelId}\n` +
            `    prompt: ${e.prompt}\n` +
            `    next fire: ${nextFire}` +
            (e.lastFiredAt ? `\n    last fired: ${e.lastFiredAt}` : '')
        );
    }

    return lines.join('\n');
};

const declaration = {
    type: "function",
    function: {
        name: "list_crons",
        description: "Lists all scheduled cron entries (both recurring and one-shot), including their schedule, target channel, prompt, and next computed fire time. Use this when the user asks what's scheduled, or before deleting an entry so you can confirm the right id.",
        parameters: {
            type: "object",
            properties: {},
            required: []
        }
    }
};

module.exports = { handler, declaration };
