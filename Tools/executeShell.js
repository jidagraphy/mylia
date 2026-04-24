const { exec } = require('child_process');
const { getConfig } = require('../Utility/config');
const { getWorkspacePath } = require('../Utility/workspaceSetup');

const MAX_LENGTH = getConfig()?.agent?.shellOutputMaxChars || 10000;
const TIMEOUT_MS = (getConfig()?.agent?.shellTimeoutSeconds || 30) * 1000;

const handler = async ({ command }) => {
    return new Promise((resolve) => {
        exec(command, { timeout: TIMEOUT_MS, cwd: getWorkspacePath() }, (error, stdout, stderr) => {
            let result = '';
            if (error) {
                result = `Error: ${error.message}\nStderr: ${stderr}`;
            } else {
                result = stdout || 'Command executed successfully with no output. (Note to AI: This means the command returned no data. If you were searching for information, reading a file, or expecting a specific result, it failed to find anything. Stop using tools for now and politely explain to the user that no information was found.)';
            }
            
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
