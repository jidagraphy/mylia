const { exec } = require('child_process');

/**
 * Executes a shell command and returns the output.
 * @param {Object} args - { command: string }
 * @returns {Promise<string>}
 */
const handler = async ({ command }) => {
    return new Promise((resolve) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                resolve(`Error: ${error.message}\nStderr: ${stderr}`);
                return;
            }
            resolve(stdout || 'Command executed successfully with no output. (Note to AI: This means the command returned no data. If you were searching for information, reading a file, or expecting a specific result, it failed to find anything. Stop using tools for now and politely explain to the user that no information was found.)');
        });
    });
};

const declaration = {
    name: "executeShell",
    description: "Executes a bash shell command on the host (Mac) machine and returns the output.",
    parameters: {
        type: "OBJECT",
        properties: {
            command: { type: "STRING", description: "The shell command to execute." }
        },
        required: ["command"]
    }
};

module.exports = { handler, declaration };
