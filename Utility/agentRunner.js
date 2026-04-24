const { chat } = require('../Clients/provider');
const { appendToHistory, getSessionHistoryByChars, HISTORY_CHAR_BUDGET } = require('./historyStore');
const { buildSystemInstruction } = require('./contextBuilder');
const { generateSessionDiary } = require('../Tools/compactHistory');
const { checkAndRenewSession, getContextKey } = require('./sessionManager');
const { availableTools, toolDeclarations } = require('../Tools');
const { getConfig } = require('./config');
const { formatProviderError, CATEGORIES } = require('./errorMessages');
const { log, error: logError } = require('./logger');

const MAX_ITERATIONS = getConfig()?.agent?.maxIterations || 10;
const DISCORD_MESSAGE_LIMIT = 2000;
const MIN_SPLIT_LOOKBACK = 1000;

const PROVIDER_DISPLAY = { gemini: 'Gemini', openrouter: 'OpenRouter', ollama: 'Ollama' };

const applyProviderError = (response) => {
    if (!response.error) return;
    const provider = getConfig()?.AI_PROVIDER;
    const providerName = PROVIDER_DISPLAY[provider] || 'Provider';
    const message = formatProviderError({ ...response.error, providerName });
    logError('Provider', `[${response.error.category}] ${response.error.detail || ''}`);

    if (response.error.category === CATEGORIES.TRUNCATED && response.content?.trim()) {
        response.content = `${response.content}\n\n_${message}_`;
    } else {
        response.content = message;
        response.tool_calls = [];
    }
};

const chunkReply = (answer) => {
    const chunks = [];
    let remaining = answer;
    while (remaining.length > 0) {
        if (remaining.length <= DISCORD_MESSAGE_LIMIT) {
            chunks.push(remaining);
            break;
        }
        let splitAt = remaining.lastIndexOf('\n', DISCORD_MESSAGE_LIMIT);
        if (splitAt < MIN_SPLIT_LOOKBACK) splitAt = remaining.lastIndexOf(' ', DISCORD_MESSAGE_LIMIT);
        if (splitAt < MIN_SPLIT_LOOKBACK) splitAt = DISCORD_MESSAGE_LIMIT;
        chunks.push(remaining.substring(0, splitAt));
        remaining = remaining.substring(splitAt).trimStart();
    }
    return chunks;
};

const runAgentTurn = async ({
    channel,
    client,
    prompt,
    images = [],
    actor = null,
    trigger = 'message',
    typing = true,
}) => {
    let typingInterval;
    try {
        if (typing && channel?.sendTyping) {
            await channel.sendTyping().catch(() => { });
            typingInterval = setInterval(() => {
                channel.sendTyping().catch(() => { });
            }, 8000);
        }

        const contextKey = getContextKey(channel, actor);
        const { renewed } = await checkAndRenewSession(contextKey, generateSessionDiary);
        if (renewed) {
            log('Session', `Implicitly renewed session for ${contextKey} due to inactivity.`);
        }

        const systemInstruction = buildSystemInstruction({ channel, client, actor, trigger, contextKey });
        const history = getSessionHistoryByChars(HISTORY_CHAR_BUDGET, contextKey);

        const currentMessage = { role: 'user', content: prompt };
        if (images.length > 0) currentMessage.images = images;

        const sourceLabel = trigger === 'cron' ? 'Cron' : (actor ? `User ${actor.username}` : 'User');
        log(sourceLabel, prompt + (images.length > 0 ? ` [+${images.length} image(s)]` : ''));

        const context = [...history, currentMessage];
        let response = await chat(systemInstruction, toolDeclarations, context);
        applyProviderError(response);
        appendToHistory({ role: 'user', content: prompt }, contextKey);

        const pendingAttachments = [];
        let iterations = 0;

        while (response.tool_calls?.length > 0 && iterations < MAX_ITERATIONS) {
            iterations++;

            appendToHistory(response, contextKey);
            context.push(response);

            for (const toolCall of response.tool_calls) {
                const toolHandler = availableTools[toolCall.function.name];
                if (toolHandler) {
                    let parsedArgs = toolCall.function.arguments;
                    if (typeof parsedArgs === 'string') {
                        if (!parsedArgs.trim()) {
                            parsedArgs = {};
                        } else {
                            try { parsedArgs = JSON.parse(parsedArgs); }
                            catch (e) { logError('Tool', `Failed to parse args for ${toolCall.function.name}: ${e.message}`); parsedArgs = {}; }
                        }
                    }

                    const argsStr = Object.keys(parsedArgs).length > 0 ? JSON.stringify(parsedArgs) : '';
                    log('Tool', `${toolCall.function.name}(${argsStr}) ...`);
                    const rawResult = await toolHandler(parsedArgs, { contextKey });

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
                    log('Tool', `${toolCall.function.name} → ${String(resultText).slice(0, 500)}`);

                    const toolMsg = { role: 'tool', tool_call_id: toolCall.id, content: resultText, name: toolCall.function.name };
                    appendToHistory(toolMsg, contextKey);
                    context.push(toolMsg);

                    if (pendingImage) {
                        context.push({ role: 'assistant', content: resultText });
                        context.push({ role: 'user', content: 'Here is the image:', images: [pendingImage] });
                    }
                } else {
                    logError('Tool', `Not found: ${toolCall.function.name}`);
                    const toolMsg = { role: 'tool', tool_call_id: toolCall.id, content: 'Tool not found', name: toolCall.function.name };
                    appendToHistory(toolMsg, contextKey);
                    context.push(toolMsg);
                }
            }

            if (iterations === MAX_ITERATIONS) {
                context.push({ role: 'user', content: 'You have reached the maximum number of tool attempts. Please provide a final text response summarizing what you have done so far.' });
            }

            response = await chat(systemInstruction, iterations === MAX_ITERATIONS ? [] : toolDeclarations, context);
            applyProviderError(response);
        }

        if (!response.content?.trim() && iterations > 0 && !response.error) {
            log('Reply', 'Response empty after tool use. Retrying without tools.');
            response = await chat(systemInstruction, [], context);
            applyProviderError(response);
        }

        if (!response.content?.trim()) {
            logError('Reply', 'Final response empty. Using fallback.');
            response = { role: 'assistant', content: '[System] Empty response from AI provider.' };
        }

        const answer = response.content;
        log('Reply', answer);
        const isHardError = response.error && response.error.category !== CATEGORIES.TRUNCATED;
        if (!isHardError) {
            appendToHistory({ role: 'assistant', content: answer }, contextKey);
        }

        if (typingInterval) clearInterval(typingInterval);

        const chunks = chunkReply(answer);
        const firstMessage = pendingAttachments.length > 0
            ? { content: chunks[0], files: pendingAttachments.map(a => ({ attachment: a.filePath, name: a.name })) }
            : chunks[0];
        await channel.send(firstMessage);
        for (let i = 1; i < chunks.length; i++) {
            await channel.send(chunks[i]);
        }

        return answer;
    } catch (error) {
        if (typingInterval) clearInterval(typingInterval);
        logError('Agent', `Failed to process turn: ${error.message}`);
        try {
            await channel.send('Sorry, I encountered an error.');
        } catch { /* channel gone or send failed */ }
        throw error;
    }
};

module.exports = { runAgentTurn };
