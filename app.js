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

client.once(Events.ClientReady, (c) => {
    log('Bot', `Ready! Logged in as ${c.user.tag}`);
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

        // TODO: discord interactive commands
        // Handle /new command for explicit session renewal
        // if (message.content.trim() === '/new') {
        //     await checkAndRenewSession(async (oldSessionId) => {
        //         await generateSessionDiary(oldSessionId);
        //     });
        //     await message.reply('New session started. Previous session diary has been saved.');
        //     return;
        // }

        const { renewed, previousSessionId } = await checkAndRenewSession(generateSessionDiary);
        if (renewed) {
            log('Session', 'Implicitly renewed session due to inactivity.');
        }

        const userPrompt = message.content.replace(`<@${client.user.id}>`, '').trim();
        const systemInstruction = buildSystemInstruction();
        const history = getSessionHistoryByTokens(4000); // Sliding window by ~tokens
        const currentMessage = { role: 'user', content: userPrompt };

        log('User', userPrompt);

        const context = [...history, currentMessage];
        let response = await chat(systemInstruction, toolDeclarations, context);
        appendToHistory(currentMessage);

        let iterations = 0;
        const maxIterations = 5;

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
                    const result = await fn(parsedArgs);
                    log('Tool', `${tc.function.name}(${argsStr}) → ${String(result).slice(0, 100)}`);

                    const toolMsg = { role: 'tool', tool_call_id: tc.id, content: result, name: tc.function.name };
                    appendToHistory(toolMsg);
                    context.push(toolMsg);
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
                ? 'I used my tools but wasn\'t able to produce a final answer. Could you try rephrasing your request?'
                : 'I wasn\'t able to generate a response. This may be a connection issue with the AI provider.';
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

        await message.reply(chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
            await message.channel.send(chunks[i]);
        }




    } catch (error) {
        clearInterval(typingInterval);
        logError('Bot', `Failed to process message: ${error.message}`);
        await message.reply('Sorry, I encountered an error.');
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
