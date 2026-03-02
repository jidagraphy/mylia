const { generateSessionDiary } = require('../Utility/summarizer');
const { checkAndRenewSession } = require('../Utility/sessionManager');

/**
 * Compacts today's chat history into a daily summary.
 * @returns {Promise<string>}
 */
const handler = async () => {
    let resultMessage = '';
    await checkAndRenewSession(async (oldSessionId) => {
        resultMessage = await generateSessionDiary(oldSessionId);
    });
    return resultMessage || '현재 세션이 갱신되며 다이어리가 생성됩니다.';
};

const declaration = {
    name: "compactHistory",
    description: "Compacts today's conversation into a daily summary (Memory/YYYY-MM-DD.md). Use when asked for compaction or when conversation is long.",
    parameters: {
        type: "OBJECT",
        properties: {},
        required: []
    }
};

module.exports = { handler, declaration };
