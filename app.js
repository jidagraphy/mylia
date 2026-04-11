const { getConfig } = require('./Utility/config');

const { setupWorkspaceEnvironment } = require('./Utility/workspaceSetup');
const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const { chat } = require('./Clients/provider');
const { appendToHistory, getSessionHistoryByTokens } = require('./Utility/historyStore');
const { buildSystemInstruction } = require('./Utility/contextBuilder');
const { generateSessionDiary } = require('./Tools/compactHistory');
const { startSession, endSession, checkAndRenewSession } = require('./Utility/sessionManager');
const { availableTools, toolDeclarations } = require('./Tools');
const { log, error: logError } = require('./Utility/logger');

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

const runSessionStartup = async () => {
    const systemInstruction = buildSystemInstruction();
    const response = await chat(systemInstruction, toolDeclarations, [{ role: 'user', content: STARTUP_PROMPT }]);
    const greeting = response.content?.trim() || null;
    if (greeting) appendToHistory({ role: 'assistant', content: greeting });
    return greeting;
};

client.once(Events.ClientReady, async (c) => {
    log('Bot', `Ready! Logged in as ${c.user.tag}`);

    await c.application.commands.set([
        { name: 'new', description: 'Start a new session (saves current session diary)' },
    ]);
    log('Bot', 'Slash commands registered.');
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'new') {
        await interaction.deferReply();
        const { previousSessionId } = await checkAndRenewSession(generateSessionDiary, { force: true });
        log('Session', `Force renewed session. Previous: ${previousSessionId}`);

        const greeting = await runSessionStartup() || 'New session started!';
        log('Session', 'Startup greeting sent.');
        await interaction.editReply(greeting);
    }
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!message.guild ? false : !message.mentions.has(client.user.id)) return;

    let typingInterval;
    try {
        await message.channel.sendTyping();
        typingInterval = setInterval(() => {
            message.channel.sendTyping().catch(() => { });
        }, 8000);

        const { renewed, previousSessionId } = await checkAndRenewSession(generateSessionDiary);
        if (renewed) {
            log('Session', 'Implicitly renewed session due to inactivity.');
        }

        const userPrompt = message.content.replace(`<@${client.user.id}>`, '').trim();
        const systemInstruction = buildSystemInstruction();
        const history = getSessionHistoryByTokens(4000); // Sliding window by ~tokens

        // Collect image attachments
        const imageAttachments = [...message.attachments.values()].filter(a => a.contentType?.startsWith('image/'));
        const images = await Promise.all(imageAttachments.map(async (attachment) => {
            const res = await fetch(attachment.url);
            const buffer = await res.arrayBuffer();
            return { data: Buffer.from(buffer).toString('base64'), mimeType: attachment.contentType.split(';')[0] };
        }));

        const currentMessage = { role: 'user', content: userPrompt };
        if (images.length > 0) currentMessage.images = images;

        log('User', userPrompt + (images.length > 0 ? ` [+${images.length} image(s)]` : ''));

        const context = [...history, currentMessage];
        let response = await chat(systemInstruction, toolDeclarations, context);
        appendToHistory({ role: 'user', content: userPrompt }); // images not persisted to avoid history bloat

        const pendingAttachments = [];
        let iterations = 0;
        const maxIterations = 10;

        // agentic loop
        while (response.tool_calls?.length > 0 && iterations < maxIterations) {
            iterations++;

            appendToHistory(response);
            context.push(response);

            for (const tc of response.tool_calls) {
                const fn = availableTools[tc.function.name];
                if (fn) {
                    let parsedArgs = tc.function.arguments;
                    if (typeof parsedArgs === 'string') {
                        if (!parsedArgs.trim()) {
                            parsedArgs = {};
                        } else {
                            try { parsedArgs = JSON.parse(parsedArgs); }
                            catch (e) { logError('Tool', `Failed to parse args for ${tc.function.name}: ${e.message}`); parsedArgs = {}; }
                        }
                    }

                    const argsStr = Object.keys(parsedArgs).length > 0 ? JSON.stringify(parsedArgs) : '';
                    log('Tool', `${tc.function.name}(${argsStr}) ...`);
                    const rawResult = await fn(parsedArgs);

                    // Tool can return { _image, text } to inject a visible image on the next turn
                    let resultText = rawResult;
                    let pendingImage = null;
                    if (rawResult && typeof rawResult === 'object' && rawResult._image) {
                        pendingImage = rawResult._image;
                        resultText = rawResult.text || 'Image loaded.';
                    }
                    if (rawResult && typeof rawResult === 'object' && rawResult._attachment) {
                        pendingAttachments.push(rawResult._attachment);
                        resultText = rawResult.text || 'Attachment queued.';
                    }
                    log('Tool', `${tc.function.name} → ${String(resultText).slice(0, 500)}`);

                    const toolMsg = { role: 'tool', tool_call_id: tc.id, content: resultText, name: tc.function.name };
                    appendToHistory(toolMsg);
                    context.push(toolMsg);

                    if (pendingImage) {
                        // Inject the image as a user message so the model can see it next turn.
                        // Not persisted to history to avoid bloat.
                        context.push({ role: 'user', content: '[Attached image from view_image tool]', images: [pendingImage] });
                    }
                } else {
                    logError('Tool', `Not found: ${tc.function.name}`);
                    const toolMsg = { role: 'tool', tool_call_id: tc.id, content: 'Tool not found', name: tc.function.name };
                    appendToHistory(toolMsg);
                    context.push(toolMsg);
                }
            }

            if (iterations === maxIterations) {
                context.push({ role: 'user', content: 'You have reached the maximum number of tool attempts. Please provide a final text response summarizing what you found.' });
            }

            response = await chat(systemInstruction, toolDeclarations, context);
        }

        if (response.tool_calls?.length > 0 && iterations >= maxIterations) {
            log('Tool', `Reached max iterations (${maxIterations}). Stopping.`);
        }

        // last resort failsafe here
        if (!response.content?.trim()) {
            logError('Reply', 'Final response empty. Using fallback.');
            const fallback = iterations > 0
                ? '[System] Tool execution completed but the model returned an empty response.'
                : '[System] Empty response from AI provider. Possible connection or model issue.';
            response = { role: 'assistant', content: fallback };
        }

        const answer = response.content;
        log('Reply', answer);
        appendToHistory({ role: 'assistant', content: answer });

        clearInterval(typingInterval);

        // Split into multiple messages if over Discord's 2000 char limit
        const chunks = [];
        let remaining = answer;
        while (remaining.length > 0) {
            if (remaining.length <= 2000) {
                chunks.push(remaining);
                break;
            }
            // Try to split at last newline within limit
            let splitAt = remaining.lastIndexOf('\n', 2000);
            if (splitAt < 1000) splitAt = remaining.lastIndexOf(' ', 2000);
            if (splitAt < 1000) splitAt = 2000;
            chunks.push(remaining.substring(0, splitAt));
            remaining = remaining.substring(splitAt).trimStart();
        }

        // await message.reply(chunks[0]);
        const firstMessage = pendingAttachments.length > 0
            ? { content: chunks[0], files: pendingAttachments.map(a => ({ attachment: a.filePath, name: a.name })) }
            : chunks[0];
        await message.channel.send(firstMessage);
        for (let i = 1; i < chunks.length; i++) {
            await message.channel.send(chunks[i]);
        }




    } catch (error) {
        clearInterval(typingInterval);
        logError('Bot', `Failed to process message: ${error.message}`);
        // await message.reply('Sorry, I encountered an error.');
        await message.channel.send('Sorry, I encountered an error.');
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
