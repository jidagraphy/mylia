const { exec } = require('child_process');

const MAX_LENGTH = 5000;

const handler = async ({ command }) => {
    return new Promise((resolve) => {
        exec(command, (error, stdout, stderr) => {
            let result = '';
            if (error) {
                result = `Error: ${error.message}\nStderr: ${stderr}`;
            } else {
                result = stdout || 'Command executed successfully with no output. (Note to AI: This means the command returned no data. If you were searching for information, reading a file, or expecting a specific result, it failed to find anything. Stop using tools for now and politely explain to the user that no information was found.)';
            }
            
            if (result.length > MAX_LENGTH) {
                result = result.substring(0, MAX_LENGTH) + '\n\n[...OUTPUT TRUNCATED: The result exceeded the maximum allowed length. DO NOT use curl or wget to fetch websites. Use the webFetch tool instead.]';
            }
            resolve(result);
        });
    });
};

const declaration = {
    type: "function",
    function: {
        name: "executeShell",
        description: "Executes a bash shell command on the host (Mac) machine and returns the output.",
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
