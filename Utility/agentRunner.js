const { chat } = require('../Clients/provider');
const { appendToHistory, getSessionHistoryByTokens } = require('./historyStore');
const { buildSystemInstruction } = require('./contextBuilder');
const { generateSessionDiary } = require('../Tools/compactHistory');
const { checkAndRenewSession, getContextKey } = require('./sessionManager');
const { availableTools, toolDeclarations } = require('../Tools');
const { log, error: logError } = require('./logger');

const MAX_ITERATIONS = 10;

const chunkReply = (answer) => {
    const chunks = [];
    let remaining = answer;
    while (remaining.length > 0) {
        if (remaining.length <= 2000) {
            chunks.push(remaining);
            break;
        }
        let splitAt = remaining.lastIndexOf('\n', 2000);
        if (splitAt < 1000) splitAt = remaining.lastIndexOf(' ', 2000);
        if (splitAt < 1000) splitAt = 2000;
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

        const systemInstruction = buildSystemInstruction({ channel, client, actor, trigger });
        const history = getSessionHistoryByTokens(4000, contextKey);

        const currentMessage = { role: 'user', content: prompt };
        if (images.length > 0) currentMessage.images = images;

        const sourceLabel = trigger === 'cron' ? 'Cron' : (actor ? `User ${actor.username}` : 'User');
        log(sourceLabel, prompt + (images.length > 0 ? ` [+${images.length} image(s)]` : ''));

        const context = [...history, currentMessage];
        let response = await chat(systemInstruction, toolDeclarations, context);
        appendToHistory({ role: 'user', content: prompt }, contextKey);

        const pendingAttachments = [];
        let iterations = 0;

        while (response.tool_calls?.length > 0 && iterations < MAX_ITERATIONS) {
            iterations++;

            appendToHistory(response, contextKey);
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

                    parsedArgs._contextKey = contextKey;
                    const argsStr = Object.keys(parsedArgs).filter(k => k !== '_contextKey').length > 0
                        ? JSON.stringify(Object.fromEntries(Object.entries(parsedArgs).filter(([k]) => k !== '_contextKey')))
                        : '';
                    log('Tool', `${tc.function.name}(${argsStr}) ...`);
                    const rawResult = await fn(parsedArgs);

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
                    appendToHistory(toolMsg, contextKey);
                    context.push(toolMsg);

                    if (pendingImage) {
                        context.push({ role: 'user', content: '[Attached image from view_image tool]', images: [pendingImage] });
                    }
                } else {
                    logError('Tool', `Not found: ${tc.function.name}`);
                    const toolMsg = { role: 'tool', tool_call_id: tc.id, content: 'Tool not found', name: tc.function.name };
                    appendToHistory(toolMsg, contextKey);
                    context.push(toolMsg);
                }
            }

            if (iterations === MAX_ITERATIONS) {
                context.push({ role: 'user', content: 'You have reached the maximum number of tool attempts. Please provide a final text response summarizing what you found.' });
            }

            response = await chat(systemInstruction, toolDeclarations, context);
        }

        if (response.tool_calls?.length > 0 && iterations >= MAX_ITERATIONS) {
            log('Tool', `Reached max iterations (${MAX_ITERATIONS}). Stopping.`);
        }

        if (!response.content?.trim()) {
            logError('Reply', 'Final response empty. Using fallback.');
            const fallback = iterations > 0
                ? '[System] Tool execution completed but the model returned an empty response.'
                : '[System] Empty response from AI provider. Possible connection or model issue.';
            response = { role: 'assistant', content: fallback };
        }

        const answer = response.content;
        log('Reply', answer);
        appendToHistory({ role: 'assistant', content: answer }, contextKey);

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
