const fs = require('fs');
const path = require('path');

const toolsDir = __dirname;

/**
 * Auto-discovers all tool modules in the Tools/ folder.
 * Each module must export { handler, declaration }.
 */
const toolFiles = fs.readdirSync(toolsDir)
    .filter(f => f !== 'index.js' && f.endsWith('.js'));

const availableTools = {};
const toolDeclarations = [];

for (const file of toolFiles) {
    const tool = require(path.join(toolsDir, file));
    // The new OpenAI schema stores the name under declaration.function.name
    const toolName = tool.declaration.function?.name || tool.declaration.name;
    availableTools[toolName] = tool.handler;
    toolDeclarations.push(tool.declaration);
}

module.exports = { availableTools, toolDeclarations };
