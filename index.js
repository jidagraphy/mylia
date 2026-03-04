require('dotenv').config();

const { setupAgentEnvironment } = require('./Utility/agentSetup');
setupAgentEnvironment(); // Ensure Agent files and folders exist at startup

const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const { chat } = require('./Clients/provider');
const { appendToHistory, getSessionHistoryByTokens } = require('./Utility/historyStore');
const { buildSystemInstruction } = require('./Utility/contextBuilder');
const { generateSessionDiary } = require('./Tools/compactHistory');
const { startSession, endSession, checkAndRenewSession } = require('./Utility/sessionManager');
const { availableTools, toolDeclarations } = require('./Tools');

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
    console.log(`Ready! Logged in as ${c.user.tag}`);
    // Session is now auto-initialized by sessionManager module load.
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

        // Handle /new command for explicit session renewal
        // if (message.content.trim() === '/new') {
        //     await checkAndRenewSession(async (oldSessionId) => {
        //         await generateSessionDiary(oldSessionId);
        //     });
        //     await message.reply('New session started. Previous session diary has been saved.');
        //     return;
        // }

        // Check for inactivity timeout and renew session if needed
        const { renewed, previousSessionId } = await checkAndRenewSession(generateSessionDiary);
        if (renewed) {
            console.log(`[Session] Implicitly renewed session due to inactivity.`);
        }

        const userPrompt = message.content.replace(`<@${client.user.id}>`, '').trim();
        const systemInstruction = buildSystemInstruction();
        const history = getSessionHistoryByTokens(4000); // Sliding window by ~tokens
        const currentMessage = { role: 'user', content: userPrompt };

        console.log(`Sending to AI: "${userPrompt}"`);

        let response = await chat(history, systemInstruction, toolDeclarations, currentMessage);
        console.log(`[AI] ${response.content || '(tool calls)'}`);
        appendToHistory(currentMessage);

        // Handle tool calls
        if (response.tool_calls?.length > 0) {
            console.log('Tool calls:', JSON.stringify(response.tool_calls, null, 2));

            // Append the assistant's tool call message to history
            appendToHistory(response);
            const context = [...history, currentMessage, response];

            const currentToolResults = [];
            for (const tc of response.tool_calls) {
                const fn = availableTools[tc.function.name];
                if (fn) {
                    console.log(`Executing: ${tc.function.name}`);
                    const result = await fn(tc.function.arguments);
                    console.log(`Result: ${result}`);

                    const toolMsg = { role: 'tool', content: result, name: tc.function.name };
                    appendToHistory(toolMsg);
                    context.push(toolMsg);
                    currentToolResults.push(`[${tc.function.name}]: ${result}`);
                } else {
                    console.warn(`Tool not found: ${tc.function.name}`);
                }
            }

            // After all tools execute, ask the AI to form a final user-facing response
            const synthesizedPrompt = `Recent tool execution results:\n${currentToolResults.join('\n')}\n\nBased on the tool execution results above, continue the conversation naturally and respond appropriately to the user.`;
            const followUp = { role: 'user', content: synthesizedPrompt };

            console.log('[Follow-up] Sending follow-up chat with tools...');
            response = await chat(context, systemInstruction, toolDeclarations, followUp);
            // console.log('[Follow-up] Response:', JSON.stringify({ content: response.content, tool_calls: response.tool_calls?.length || 0 }));

            // If the AI still returns empty or tries more tool calls, retry without tools to force text
            if (!response.content || response.tool_calls?.length > 0) {
                console.log('[Follow-up] Empty or more tool calls — retrying without tools...');
                response = await chat(context, systemInstruction, [], followUp);
                // console.log('[Follow-up] Retry response:', JSON.stringify({ content: response.content }));
            }

            // Last resort: if still empty, use the tool results directly
            if (!response.content) {
                response = { role: 'assistant', content: currentToolResults.join('\n') || 'Tools executed but returned no usable response.' };
                console.log('[Follow-up] Using raw tool results as response.');
            }
        }

        const answer = response.content;
        console.log(`[Reply] ${answer}`);
        appendToHistory({ role: 'assistant', content: answer });

        clearInterval(typingInterval);
        await message.reply(answer.length > 2000 ? answer.substring(0, 1996) + '...' : answer);




    } catch (error) {
        clearInterval(typingInterval);
        console.error('Failed to process message:', error);
        await message.reply('Sorry, I encountered an error.');
    }
});

// Graceful shutdown
const shutdown = async () => {
    console.log('\nShutting down gracefully...');
    // We no longer forcefully end sessions on shutdown.
    // They will be naturally renewed via inactivity timeout.
    client.destroy();
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

client.login(process.env.DISCORD_BOT_TOKEN);
