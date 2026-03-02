require('dotenv').config();

const { setupAgentEnvironment } = require('./Utility/agentSetup');
setupAgentEnvironment(); // Ensure Agent files and folders exist at startup

const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const { chat } = require('./Clients/provider');
const { appendToHistory, getSessionHistoryByTokens } = require('./Utility/historyStore');
const { buildSystemInstruction } = require('./Utility/contextBuilder');
const { checkAutoCompaction, generateSessionDiary } = require('./Utility/summarizer');
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

    try {
        await message.channel.sendTyping();

        // Handle /new command for explicit session renewal
        // if (message.content.trim() === '/new') {
        //     await checkAndRenewSession(async (oldSessionId) => {
        //         await generateSessionDiary(oldSessionId);
        //     });
        //     await message.reply('새로운 세션이 시작되었습니다. 이전 세션 다이어리가 저장되었습니다.');
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
        appendToHistory(currentMessage);

        // Handle tool calls
        if (response.tool_calls?.length > 0) {
            console.log('Tool calls:', JSON.stringify(response.tool_calls, null, 2));

            // Append the assistant's tool call message to history
            appendToHistory(response);
            const context = [...history, currentMessage, response];

            for (const tc of response.tool_calls) {
                const fn = availableTools[tc.function.name];
                if (fn) {
                    console.log(`Executing: ${tc.function.name}`);
                    const result = await fn(tc.function.arguments);
                    console.log(`Result: ${result}`);

                    const toolMsg = { role: 'tool', content: result, name: tc.function.name };
                    appendToHistory(toolMsg);
                    context.push(toolMsg);
                } else {
                    console.warn(`Tool not found: ${tc.function.name}`);
                }
            }

            // After all tools execute, ask the AI to form a final user-facing response
            // We pass the full updated context, and an empty dummy user message or just rely on context
            // Many APIs prefer a dummy system/user message to trigger the final turn
            response = await chat(context, systemInstruction, toolDeclarations, { role: 'user', content: '방금 도구 실행 결과를 바탕으로, 자연스럽게 이전 대화를 이어나가며 적절한 대답을 해줘.' });
        }

        const answer = response.content || 'Done.';
        appendToHistory({ role: 'assistant', content: answer });

        await message.reply(answer.length > 2000 ? answer.substring(0, 1996) + '...' : answer);

        // Auto-compaction check (fire-and-forget) - temporarily disabled
        checkAutoCompaction().catch(e => console.error('[Auto-Compaction]', e.message));

    } catch (error) {
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
