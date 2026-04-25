const os = require('os');
const { getConfig } = require('./Utility/config');

const { setupWorkspaceEnvironment } = require('./Utility/workspaceSetup');
const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const { chat } = require('./Clients/provider');
const { appendToHistory, getReplaySize, getTrimmedReplaySize, HISTORY_CHAR_BUDGET, getLastUserMessageTimestamp } = require('./Utility/historyStore');
const { buildSystemInstruction } = require('./Utility/contextBuilder');
const { generateSessionDiary } = require('./Tools/compactHistory');
const { checkAndRenewSession, getContextKey } = require('./Utility/sessionManager');
const { toolDeclarations } = require('./Tools');
const { log, error: logError } = require('./Utility/logger');
const { runAgentTurn } = require('./Utility/agentRunner');
const { setClient } = require('./Utility/discordClient');
const { startCronRunner } = require('./Utility/cronRunner');

setupWorkspaceEnvironment();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
});

const STARTUP_PROMPT = `A new session has just started. Greet the user in your persona — keep it to 2-3 sentences.`;

const runSessionStartup = async ({ channel, actor } = {}) => {
    const contextKey = getContextKey(channel, actor);
    const systemInstruction = buildSystemInstruction({ channel, client, actor, trigger: 'slash_command', contextKey });
    const response = await chat(systemInstruction, toolDeclarations, [{ role: 'user', content: STARTUP_PROMPT }]);
    const greeting = response.content?.trim() || null;
    if (greeting) appendToHistory({ role: 'assistant', content: greeting }, contextKey);
    return greeting;
};

client.once(Events.ClientReady, async (readyClient) => {
    log('Bot', `Ready! Logged in as ${readyClient.user.tag}`);
    setClient(readyClient);

    await readyClient.application.commands.set([
        {
            name: 'new',
            description: 'Start a new session (saves current session diary)',
            options: [
                {
                    name: 'message',
                    description: 'First message to send in the new session',
                    type: 3, // STRING
                    required: false,
                },
            ],
        },
        { name: 'status', description: 'Show runtime context and context size breakdown' },
    ]);
    log('Bot', 'Slash commands registered.');

    startCronRunner(readyClient);
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'status') {
        const contextKey = getContextKey(interaction.channel, interaction.user);
        const systemInstruction = buildSystemInstruction({ channel: interaction.channel, client, actor: interaction.user, trigger: 'slash_command', contextKey });
        const sysChars = systemInstruction.length;
        const replayFull = getReplaySize(contextKey);
        const replaySent = getTrimmedReplaySize(contextKey);
        const totalSent = sysChars + replaySent;
        const k = (n) => `${Math.round(n / 1000)}k`;

        const config = getConfig();
        const lastTs = getLastUserMessageTimestamp(contextKey);
        const lastMsg = lastTs ? new Date(lastTs).toLocaleString() : 'none';

        const guild = interaction.channel?.guild;
        const channelLine = guild
            ? `#${interaction.channel.name} in **${guild.name}**`
            : `DM (channel id: ${interaction.channel?.id})`;

        const allChannels = guild
            ? [...guild.channels.cache.values()].filter(c => typeof c.isTextBased === 'function' && c.isTextBased()).map(c => `#${c.name}`).join(', ')
            : null;

        const lines = [
            `**Status**`,
            `Bot: \`${client.user.tag}\` (id: \`${client.user.id}\`)`,
            `Model: \`${config.AI_MODEL || 'unknown'}\` via \`${config.AI_PROVIDER || 'unknown'}\``,
            `Host: \`${os.hostname()}\` — ${os.platform()} ${os.release()} (user: ${os.userInfo().username})`,
            '',
            '**Channel**',
            channelLine,
            ...(allChannels ? [`Available: ${allChannels}`] : []),
            '',
            '**Context**',
            `System instruction: \`${k(sysChars)}\` chars`,
            `Session replay — full: \`${k(replayFull)}\` chars`,
            `Session replay — sent: \`${k(replaySent)}\` / \`${k(HISTORY_CHAR_BUDGET)}\` budget`,
            `Total sent to AI: \`${k(totalSent)}\` chars`,
            '',
            `Last message: ${lastMsg}`,
        ];

        await interaction.reply(lines.join('\n'));
        return;
    }

    if (interaction.commandName === 'new') {
        await interaction.deferReply();
        const contextKey = getContextKey(interaction.channel, interaction.user);
        const { previousSessionId } = await checkAndRenewSession(contextKey, generateSessionDiary, { force: true });
        log('Session', `Force renewed session for ${contextKey}. Previous: ${previousSessionId}`);

        const firstMessage = interaction.options.getString('message');
        if (firstMessage) {
            await interaction.editReply(`> ${firstMessage}`);
            await runAgentTurn({
                channel: interaction.channel,
                client,
                prompt: firstMessage,
                actor: interaction.user,
                trigger: 'slash_command',
                typing: true,
            });
        } else {
            const greeting = await runSessionStartup({ channel: interaction.channel, actor: interaction.user }) || 'New session started!';
            log('Session', 'Startup greeting sent.');
            await interaction.editReply(greeting);
        }
    }
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (message.guild && !message.mentions.has(client.user.id)) return;

    const userPrompt = message.content.replace(`<@${client.user.id}>`, '').trim();

    const imageAttachments = [...message.attachments.values()].filter(a => a.contentType?.startsWith('image/'));
    const images = await Promise.all(imageAttachments.map(async (attachment) => {
        const res = await fetch(attachment.url);
        const buffer = await res.arrayBuffer();
        return { data: Buffer.from(buffer).toString('base64'), mimeType: attachment.contentType.split(';')[0] };
    }));

    try {
        await runAgentTurn({
            channel: message.channel,
            client,
            prompt: userPrompt,
            images,
            actor: message.author,
            trigger: 'message',
            typing: true,
        });
    } catch (error) {
        logError('Bot', `Failed to process message: ${error.message}`);
    }
});

const shutdown = async () => {
    log('Bot', 'Shutting down gracefully...');
    client.destroy();
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

client.login(getConfig().DISCORD_BOT_TOKEN);
