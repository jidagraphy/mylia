const { getConfig } = require('./Utility/config');

const { setupWorkspaceEnvironment } = require('./Utility/workspaceSetup');
const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const { chat } = require('./Clients/provider');
const { appendToHistory } = require('./Utility/historyStore');
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

client.once(Events.ClientReady, async (c) => {
    log('Bot', `Ready! Logged in as ${c.user.tag}`);
    setClient(c);

    await c.application.commands.set([
        { name: 'new', description: 'Start a new session (saves current session diary)' },
    ]);
    log('Bot', 'Slash commands registered.');

    startCronRunner(c);
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'new') {
        await interaction.deferReply();
        const contextKey = getContextKey(interaction.channel, interaction.user);
        const { previousSessionId } = await checkAndRenewSession(contextKey, generateSessionDiary, { force: true });
        log('Session', `Force renewed session for ${contextKey}. Previous: ${previousSessionId}`);

        const greeting = await runSessionStartup({ channel: interaction.channel, actor: interaction.user }) || 'New session started!';
        log('Session', 'Startup greeting sent.');
        await interaction.editReply(greeting);
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
