const { CronExpressionParser } = require('cron-parser');
const { loadEntries, updateEntry } = require('./cronStore');
const { getClient } = require('./discordClient');
const { runAgentTurn } = require('./agentRunner');
const { log, error: logError } = require('./logger');

const TICK_MS = 60 * 1000;

let intervalHandle = null;
const firingIds = new Set();

const fireEntry = async (entry, firedTime) => {
    if (firingIds.has(entry.id)) return;
    firingIds.add(entry.id);

    const client = getClient();
    if (!client) {
        logError('Cron', `No Discord client available to fire ${entry.id}`);
        firingIds.delete(entry.id);
        return;
    }

    try {
        const channel = await client.channels.fetch(entry.channelId).catch(() => null);
        if (!channel) {
            logError('Cron', `Channel ${entry.channelId} not reachable for ${entry.id}`);
            firingIds.delete(entry.id);
            return;
        }

        log('Cron', `Firing ${entry.id} (${entry.type}) → channel ${entry.channelId}`);

        await runAgentTurn({
            channel,
            client,
            prompt: entry.prompt,
            actor: null,
            trigger: 'cron',
            typing: false,
            historyBudget: entry.includeHistory ? null : 0,
        });

        if (entry.type === 'at') {
            updateEntry(entry.id, { fired: true, lastFiredAt: new Date().toISOString() });
        } else {
            updateEntry(entry.id, { lastFiredAt: firedTime.toISOString() });
        }
    } catch (e) {
        logError('Cron', `Failed to fire ${entry.id}: ${e.message}`);
    } finally {
        firingIds.delete(entry.id);
    }
};

const tick = async () => {
    const entries = loadEntries();
    const now = new Date();

    for (const entry of entries) {
        if (firingIds.has(entry.id)) continue;
        if (entry.enabled === false) continue;

        if (entry.type === 'at') {
            if (entry.fired) continue;
            const scheduled = new Date(entry.schedule);
            if (isNaN(scheduled.getTime())) {
                logError('Cron', `Invalid 'at' timestamp for ${entry.id}: ${entry.schedule}`);
                continue;
            }
            if (scheduled <= now) {
                fireEntry(entry, scheduled);
            }
            continue;
        }

        if (entry.type === 'cron') {
            let iter;
            try {
                iter = CronExpressionParser.parse(entry.schedule, {
                    currentDate: now,
                    tz: entry.timezone || undefined,
                });
            } catch (e) {
                logError('Cron', `Invalid cron expression for ${entry.id} (${entry.schedule}): ${e.message}`);
                continue;
            }

            let latestFireBefore;
            try {
                latestFireBefore = iter.prev().toDate();
            } catch {
                continue;
            }

            const baseline = entry.lastFiredAt
                ? new Date(entry.lastFiredAt)
                : new Date(entry.createdAt || now);

            if (latestFireBefore > baseline) {
                fireEntry(entry, latestFireBefore);
            }
        }
    }
};

const startCronRunner = (client) => {
    if (intervalHandle) return;

    const entries = loadEntries();
    const nowIso = new Date().toISOString();
    for (const entry of entries) {
        if (entry.type === 'cron' && !entry.lastFiredAt) {
            updateEntry(entry.id, { lastFiredAt: nowIso });
        }
    }

    log('Cron', `Starting cron runner (${loadEntries().length} entries, tick every ${TICK_MS / 1000}s)`);
    intervalHandle = setInterval(() => {
        tick().catch(e => logError('Cron', `Tick error: ${e.message}`));
    }, TICK_MS);
};

const stopCronRunner = () => {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
};

module.exports = { startCronRunner, stopCronRunner, tick };
