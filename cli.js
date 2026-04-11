#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_DIR = path.resolve(__dirname);
const { getConfig } = require('./Utility/config');
const { setupWorkspaceEnvironment, getWorkspacePath } = require('./Utility/workspaceSetup');
const PID_FILE = path.join(getWorkspacePath(), '.pid');
const LOG_FILE = path.join(getWorkspacePath(), '.log');

const command = process.argv[2];
const arg = process.argv[3];





// utils

const isRunning = (pid) => {
    try { process.kill(pid, 0); return true; }
    catch { return false; }
};

const getSavedPid = () => {
    if (!fs.existsSync(PID_FILE)) return null;
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    return isNaN(pid) ? null : pid;
};



const ensureSetup = async () => {
    setupWorkspaceEnvironment();

    const config = getConfig();
    if (!config) {
        console.error('❌ Error: Could not load config.json.');
        process.exit(1);
    }

    const { DISCORD_BOT_TOKEN, AI_PROVIDER, OPENROUTER_API_KEY, GEMINI_API_KEY, OLLAMA_URL } = config;

    let valid = true;

    if (!DISCORD_BOT_TOKEN || DISCORD_BOT_TOKEN === 'your_discord_bot_token_here') {
        valid = false;
    } else if (AI_PROVIDER === 'openrouter' && (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'your_openrouter_api_key_here')) {
        valid = false;
    } else if (AI_PROVIDER === 'gemini' && (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here')) {
        valid = false;
    } else if (AI_PROVIDER === 'ollama' && !OLLAMA_URL) {
        valid = false;
    }

    return valid;
};








// commands
const start = async () => {
    const isValid = await ensureSetup();
    if (!isValid) {
        console.log('✨ Fresh installation or missing configuration detected! Routing to setup guide...\n');
        configure();
        return;
    }

    const existing = getSavedPid();
    if (existing && isRunning(existing)) {
        console.log(`mylia is already running (PID: ${existing})`);
        return;
    }

    const logFd = fs.openSync(LOG_FILE, 'a');
    const child = spawn('node', [path.join(APP_DIR, 'app.js')], {
        detached: true,
        stdio: ['ignore', logFd, logFd],
        cwd: APP_DIR,
        env: { ...process.env }
    });

    fs.writeFileSync(PID_FILE, String(child.pid));
    child.unref();

    console.log(`mylia v${version} started (PID: ${child.pid})`);
    console.log(`Logs: ${LOG_FILE}`);
};

const stop = () => {
    const pid = getSavedPid();
    if (!pid || !isRunning(pid)) {
        console.log('mylia is not running.');
        if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
        return;
    }

    process.kill(pid, 'SIGTERM');
    console.log(`mylia stopped (PID: ${pid})`);
    fs.unlinkSync(PID_FILE);
};

const status = () => {
    const pid = getSavedPid();
    const running = pid && isRunning(pid);
    const config = getConfig() || {};
    const provider = config.AI_PROVIDER || 'not set';
    const model = config.AI_MODEL || 'not set';

    console.log(`Status:   ${running ? `\x1b[32mrunning\x1b[0m (PID: ${pid})` : '\x1b[31mstopped\x1b[0m'}`);
    console.log(`Provider: ${provider}`);
    console.log(`Model:    ${model}`);
};

const logs = () => {
    if (!fs.existsSync(LOG_FILE)) {
        console.log('No log file found. Start mylia first.');
        return;
    }

    console.log(`Tailing ${LOG_FILE} (Ctrl+C to exit)\n`);
    const tail = spawn('tail', ['-f', LOG_FILE], { stdio: 'inherit' });
    process.on('SIGINT', () => { tail.kill(); process.exit(0); });
};

const configure = () => {
    setupWorkspaceEnvironment();
    const configPath = require('./Utility/config').CONFIG_FILE;
    const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';

    console.log(`Opening config: ${configPath}`);
    console.log(`(If this doesn't work, edit it manually: vim ${configPath})`);
    require('child_process').exec(`${openCmd} "${configPath}"`);
};













const restart = async () => {
    stop();
    await start();
};

const installSkill = async (repoUrl) => {
    await ensureSetup();
    if (!repoUrl) {
        console.error('Usage: mylia install-skill <github-repo-url>');
        process.exit(1);
    }

    const { getWorkspacePath } = require('./Utility/workspaceSetup');
    const skillsDir = path.join(getWorkspacePath(), 'Skills');

    if (!fs.existsSync(skillsDir)) {
        fs.mkdirSync(skillsDir, { recursive: true });
    }

    // Extract repo name from URL to use as folder name
    const repoMatch = repoUrl.match(/\/([^/]+?)(?:\.git)?$/);
    if (!repoMatch) {
        console.error('Invalid repository URL. Please provide a valid GitHub/Git URL.');
        process.exit(1);
    }

    const skillName = repoMatch[1];
    const targetDir = path.join(skillsDir, skillName);

    if (fs.existsSync(targetDir)) {
        console.error(`Skill '${skillName}' already exists in ${targetDir}`);
        console.log('To update, you must manually delete the folder or run git pull inside it.');
        process.exit(1);
    }

    console.log(`Installing skill '${skillName}' from ${repoUrl}...`);
    try {
        execSync(`git clone ${repoUrl} ${targetDir}`, { stdio: 'inherit' });
        console.log(`\n✨ Successfully installed skill: ${skillName}`);

        // Verify if SKILL.md exists
        if (!fs.existsSync(path.join(targetDir, 'SKILL.md'))) {
            console.warn(`\n⚠️ Warning: No SKILL.md found in ${skillName}. The agent may not be able to read this skill's instructions.`);
        }
    } catch (error) {
        console.error(`\n❌ Failed to install skill.`);
        process.exit(1);
    }
};

// routers

const version = require('./package.json').version;

const help = () => {
    console.log(`
  🧚 mylia v${version}

  Usage:
    mylia start              Start the daemon
    mylia stop               Stop the daemon
    mylia status             Show running status, provider, and model
    mylia logs               Tail the live console output
    mylia config             Interactive settings editor
    mylia restart            Restart the daemon
    mylia install-skill <url> Install a ClawHub skill from a Git repository
`);
};

switch (command) {
    case 'start': start(); break;
    case 'stop': stop(); break;
    case 'restart': restart(); break;
    case 'status': status(); break;
    case 'logs': logs(); break;
    case 'config':
    case 'configure':
    case 'settings': configure(); break;
    case 'install-skill':
    case 'install': installSkill(arg); break;
    default: help(); break;
}
