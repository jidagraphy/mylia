const { exec } = require('child_process');
const { getConfig } = require('../Utility/config');
const { getWorkspacePath } = require('../Utility/workspaceSetup');

const MAX_LENGTH = getConfig()?.agent?.shellOutputMaxChars || 10000;
const TIMEOUT_MS = (getConfig()?.agent?.shellTimeoutSeconds || 30) * 1000;

const handler = async ({ command }) => {
    return new Promise((resolve) => {
        exec(command, { timeout: TIMEOUT_MS, cwd: getWorkspacePath() }, (error, stdout, stderr) => {
            // Report facts only: status + stdout + stderr. No editorializing — empty output is normal for mkdir, git add, etc.
            let status = 'exit code: 0';
            if (error?.killed) status = `timed out after ${TIMEOUT_MS / 1000}s (killed)`;
            else if (typeof error?.code === 'number') status = `exit code: ${error.code}`;
            else if (error) status = `error: ${error.message}`;

            const parts = [status];
            if (stdout) parts.push(`stdout:\n${stdout}`);
            if (stderr) parts.push(`stderr:\n${stderr}`);
            if (!stdout && !stderr) parts.push('(no output)');
            let result = parts.join('\n');

            if (result.length > MAX_LENGTH) {
                result = result.substring(0, MAX_LENGTH) + `\n\n[...OUTPUT TRUNCATED: Result exceeded ${MAX_LENGTH} chars. Constrain output with head, tail, or grep. Do not use curl/wget — use web_fetch instead.]`;
            }
            resolve(result);
        });
    });
};

const declaration = {
    type: "function",
    function: {
        name: "execute_shell",
        description: "Executes a bash shell command on the host machine and returns the output. Commands are subject to a timeout and output length cap. Never run destructive commands (rm -rf, mv, chmod, mkfs, dd, etc.) without explicit user confirmation. Prefer reversible alternatives (e.g. trash over rm). Keep output small — avoid commands that dump large volumes of text (e.g. cat on big files, find / without limits, unfiltered logs). Use head, tail, or grep to constrain output. Always use web_fetch for fetching websites unless the user explicitly asks for curl/wget by name.",
        parameters: {
            type: "object",
            properties: {
                command: { type: "string", description: "The shell command to execute." }
            },
            required: ["command"]
        }
    }
};

module.exports = { handler, declaration };
