const { CronExpressionParser } = require('cron-parser');
const { addEntry } = require('../Utility/cronStore');
const { getClient } = require('../Utility/discordClient');

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

const detectType = (schedule) => {
    if (ISO_RE.test(schedule.trim())) return 'at';
    return 'cron';
};

const handler = async ({ schedule, channelId, prompt, timezone }) => {
    if (typeof schedule !== 'string' || !schedule.trim()) {
        return 'Error: schedule is required.';
    }
    if (typeof channelId !== 'string' || !channelId.trim()) {
        return 'Error: channelId is required.';
    }
    if (typeof prompt !== 'string' || !prompt.trim()) {
        return 'Error: prompt is required.';
    }

    const client = getClient();
    if (client) {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            return `Error: channel ${channelId} is not reachable by the bot.`;
        }
    }

    const type = detectType(schedule);
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    let nextFire;
    if (type === 'at') {
        const when = new Date(schedule);
        if (isNaN(when.getTime())) {
            return `Error: invalid ISO timestamp: ${schedule}`;
        }
        if (when <= new Date()) {
            return `Error: 'at' timestamp ${schedule} is in the past.`;
        }
        nextFire = when;
    } else {
        try {
            const iter = CronExpressionParser.parse(schedule, { tz });
            nextFire = iter.next().toDate();
        } catch (e) {
            return `Error: invalid cron expression "${schedule}": ${e.message}`;
        }
    }

    const id = `cron_${Date.now()}`;
    const entry = {
        id,
        type,
        schedule,
        timezone: type === 'cron' ? tz : undefined,
        channelId,
        prompt,
        createdAt: new Date().toISOString(),
        lastFiredAt: null,
    };
    if (type === 'at') entry.fired = false;

    addEntry(entry);

    return `Scheduled ${type} "${id}" → ${schedule} → channel ${channelId}. Next fire: ${nextFire.toISOString()} (${tz}). Prompt: "${prompt}"`;
};

const declaration = {
    type: "function",
    function: {
        name: "create_cron",
        description: "Schedules a prompt to be run by the agent at a specific time or on a recurring schedule, with the reply going to a chosen Discord channel. Use this for reminders, daily check-ins, recurring tasks, or any 'remind/tell me later' requests. When the cron fires, the stored prompt is passed through the normal agent turn in the target channel, so write it as if the user were asking the agent to do the task right now.",
        parameters: {
            type: "object",
            properties: {
                schedule: {
                    type: "string",
                    description: "Either a 5-field cron expression (e.g. '0 9 * * *' = daily at 9am, '*/15 * * * *' = every 15 min) for recurring schedules, OR an ISO 8601 timestamp (e.g. '2026-04-13T15:00:00+09:00') for one-shot schedules. Type is auto-detected from format."
                },
                channelId: {
                    type: "string",
                    description: "Target Discord channel ID (copy from the AVAILABLE CHANNELS section in the system prompt)."
                },
                prompt: {
                    type: "string",
                    description: "The prompt the agent will receive when the cron fires. Write it in first-person as if the user were asking, e.g. 'Send me today's morning summary.' or 'Remind me I have a 3pm meeting.'"
                },
                timezone: {
                    type: "string",
                    description: "Optional IANA timezone for cron expressions (e.g. 'Asia/Seoul', 'America/New_York'). Defaults to system timezone. Ignored for 'at' schedules."
                }
            },
            required: ["schedule", "channelId", "prompt"]
        }
    }
};

module.exports = { handler, declaration };
