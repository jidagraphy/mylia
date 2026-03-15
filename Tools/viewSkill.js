const { readSkillContent } = require('../Utility/skillManager');

const declaration = {
    type: "function",
    function: {
        name: 'viewSkill',
        description: 'Reads the full SKILL.md documentation for a specific skill. You MUST use this tool to read the instructions for a skill before attempting a task that relies on it.',
        parameters: {
            type: 'object',
            properties: {
                skillName: {
                    type: 'string',
                    description: 'The name of the skill to read (e.g., "test-coding")'
                }
            },
            required: ['skillName']
        }
    }
};

async function handler(args) {
    if (!args.skillName) {
        return 'Error: skillName is required.';
    }
    
    return readSkillContent(args.skillName);
}

module.exports = {
    declaration,
    handler
};
