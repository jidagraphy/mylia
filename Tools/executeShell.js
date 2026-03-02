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
            resolve(stdout || 'Command executed successfully with no output.');
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
