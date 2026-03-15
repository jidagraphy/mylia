const fs = require('fs');
const path = require('path');
const { getWorkspacePath } = require('./workspaceSetup');

const getSkillsDir = () => path.join(getWorkspacePath(), 'Skills');

/**
 * Parses frontmatter from a markdown string.
 * Basic implementation to extract name and description.
 */
function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    const frontmatter = match[1];
    const metadata = {};
    
    // Quick regex to grab name and description
    const lines = frontmatter.split('\n');
    for (const line of lines) {
        const [key, ...values] = line.split(':');
        if (key && values.length > 0) {
            metadata[key.trim()] = values.join(':').trim().replace(/^['"](.*)['"]$/, '$1'); // remove quotes if present
        }
    }
    
    return metadata;
}

/**
 * Scans the Skills directory and returns metadata for all installed skills.
 */
function getInstalledSkills() {
    const skillsDir = getSkillsDir();
    if (!fs.existsSync(skillsDir)) return [];

    const skills = [];
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isDirectory()) {
            const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
            if (fs.existsSync(skillPath)) {
                try {
                    const content = fs.readFileSync(skillPath, 'utf8');
                    const metadata = parseFrontmatter(content);
                    
                    if (metadata && metadata.name) {
                        skills.push({
                            folder: entry.name,
                            name: metadata.name,
                            description: metadata.description || 'No description provided.',
                        });
                    }
                } catch (e) {
                    console.error(`[SkillManager] Failed to read SKILL.md for ${entry.name}:`, e.message);
                }
            }
        }
    }

    return skills;
}

/**
 * Reads the content of a specific SKILL.md.
 */
function readSkillContent(skillName) {
    const skillsDir = getSkillsDir();
    const skills = getInstalledSkills();
    
    // Find the folder corresponding to the skill name
    const skill = skills.find(s => s.name === skillName || s.folder === skillName);
    if (!skill) {
        return `Error: Skill '${skillName}' not found.`;
    }

    const skillPath = path.join(skillsDir, skill.folder, 'SKILL.md');
    try {
        return fs.readFileSync(skillPath, 'utf8');
    } catch (e) {
        return `Error: Failed to read skill '${skillName}': ${e.message}`;
    }
}

module.exports = {
    getInstalledSkills,
    readSkillContent
};
