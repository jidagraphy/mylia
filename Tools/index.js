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
    availableTools[tool.declaration.name] = tool.handler;
    toolDeclarations.push(tool.declaration);
}

module.exports = { availableTools, toolDeclarations };
