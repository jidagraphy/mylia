const fs = require('fs');
const path = require('path');
const { complete } = require('../Clients/provider');
const { getFullHistory } = require('./historyStore');

const memoryDir = path.resolve(__dirname, '../Agent/Memory');
const COMPACTION_THRESHOLD = 30;

/**
 * Ensures the Memory directory exists.
 */
const ensureMemoryDir = () => {
    if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });
};

/**
 * Reads a session diary if it exists.
 * @param {string} sessionId - YYYY-MM-DD_NNN
 * @returns {string}
 */
const readSessionDiary = (sessionId) => {
    const filePath = path.join(memoryDir, `${sessionId}.md`);
    if (!fs.existsSync(filePath)) return '';
    try { return fs.readFileSync(filePath, 'utf8').trim(); }
    catch { return ''; }
};

/**
 * Summarizes a given session's history into a session diary.
 * @param {string} sessionId
 * @returns {Promise<string>} Status message.
 */
const generateSessionDiary = async (sessionId) => {
    const messages = getFullHistory(sessionId);

    if (messages.length === 0) return `세션(${sessionId})의 대화 기록이 없어 다이어리를 생성할 내용이 없습니다.`;

    const historyText = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => `[${m.timestamp || ''}] [${m.role}]: ${m.content}`)
        .join('\n');

    const prompt = `아래는 세션(${sessionId})의 대화 내용이다:\n${historyText}\n\n이 대화에서 있었던 핵심 사실, 흥미로운 점, 결정된 사항, 대화의 전반적인 맥락을 상세하게 정리하여 불릿포인트 형태의 세션 일기로 작성해라. 한국어로.`;

    try {
        const summary = await complete(prompt);
        if (!summary) return '세션 다이어리 생성에 실패했습니다.';

        ensureMemoryDir();
        fs.writeFileSync(path.join(memoryDir, `${sessionId}.md`), summary);
        console.log(`[Session Diary] Saved session diary to Memory/${sessionId}.md`);
        return `다이어리 생성 완료! Memory/${sessionId}.md에 세션 다이어리를 저장했습니다.`;
    } catch (error) {
        console.error('[Session Diary] Failed:', error.message);
        return `다이어리 생성 실패: ${error.message}`;
    }
};

/**
 * Checks if auto-compaction should trigger (fire-and-forget from index.js).
 * Temporarily disabled in favor of session management.
 */
const checkAutoCompaction = async () => {
    // const messages = getSessionHistory();
    // if (messages.length > COMPACTION_THRESHOLD) {
    //     console.log(`[Auto-Compaction] ${messages.length} messages exceed threshold (${COMPACTION_THRESHOLD}). Compacting...`);
    //     await compactHistory();
    // }
};

module.exports = { readSessionDiary, generateSessionDiary, checkAutoCompaction };
