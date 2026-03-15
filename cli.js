#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_DIR = path.resolve(__dirname);
const PID_FILE = path.join(require('os').homedir(), '.mylia.pid');
const LOG_FILE = path.join(require('os').homedir(), '.mylia.log');
const ENV_FILE = path.join(APP_DIR, '.env');

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

const readEnvValue = (key) => {
    if (!fs.existsSync(ENV_FILE)) return null;
    const match = fs.readFileSync(ENV_FILE, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1].trim() : null;
};

const writeEnvValue = (key, value) => {
    if (!fs.existsSync(ENV_FILE)) {
        fs.writeFileSync(ENV_FILE, `${key}=${value}\n`);
        return;
    }
    let content = fs.readFileSync(ENV_FILE, 'utf8');
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
        content = content.replace(regex, `${key}=${value}`);
    } else {
        content += `\n${key}=${value}`;
    }
    fs.writeFileSync(ENV_FILE, content);
};


const ENV_TEMPLATE = path.join(APP_DIR, '.env.template');
const rl = require('readline');
const os = require('os');

const ensureSetup = async () => {
    if (!fs.existsSync(ENV_FILE)) {
        if (fs.existsSync(ENV_TEMPLATE)) {
            fs.copyFileSync(ENV_TEMPLATE, ENV_FILE);
            console.log('Created .env from .env.template');
        } else {
            console.error('No .env or .env.template found. Cannot continue.');
            process.exit(1);
        }
    }

    require('dotenv').config({ path: ENV_FILE, override: true });

    if (!process.env.WORKSPACE_PATH?.trim()) {
        const defaultPath = path.join(os.homedir(), '.mylia');
        const answer = await new Promise((resolve) => {
            const iface = rl.createInterface({ input: process.stdin, output: process.stdout });
            iface.question(`Workspace path (default: ${defaultPath}): `, (ans) => {
                iface.close();
                resolve(ans.trim() || defaultPath);
            });
        });

        const resolved = answer.startsWith('~')
            ? path.resolve(os.homedir(), answer.slice(2))
            : path.resolve(answer);

        writeEnvValue('WORKSPACE_PATH', resolved);
        process.env.WORKSPACE_PATH = resolved;
        console.log(`Workspace set to: ${resolved}`);
    }
    // validation
    const { DISCORD_BOT_TOKEN, AI_PROVIDER, OPENROUTER_API_KEY, GEMINI_API_KEY, OLLAMA_URL } = process.env;

    if (!DISCORD_BOT_TOKEN || DISCORD_BOT_TOKEN === 'your_discord_bot_token_here') {
        console.error('❌ Error: DISCORD_BOT_TOKEN is missing or invalid.');
        console.log('💡 Run `mylia config` or edit your .env file to set it.');
        process.exit(1);
    }

    if (AI_PROVIDER === 'openrouter' && (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'your_openrouter_api_key_here')) {
        console.error('❌ Error: OPENROUTER_API_KEY is missing for the "openrouter" provider.');
        console.log('💡 Run `mylia config` to set it, or change your AI_PROVIDER.');
        process.exit(1);
    }

    if (AI_PROVIDER === 'gemini' && (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here')) {
        console.error('❌ Error: GEMINI_API_KEY is missing for the "gemini" provider.');
        console.log('💡 Run `mylia config` to set it, or change your AI_PROVIDER.');
        process.exit(1);
    }

    if (AI_PROVIDER === 'ollama' && !OLLAMA_URL) {
        console.error('❌ Error: OLLAMA_URL is missing for the "ollama" provider.');
        console.log('💡 Run `mylia config` to set it (default: http://127.0.0.1:11434).');
        process.exit(1);
    }
};








// commands
const start = async () => {
    await ensureSetup();

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

    console.log(`mylia started (PID: ${child.pid})`);
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
    const provider = readEnvValue('AI_PROVIDER') || 'not set';
    const model = readEnvValue('AI_MODEL') || 'not set';

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

const readline = require('readline');

const configure = () => {
    if (!fs.existsSync(ENV_FILE)) {
        console.log('No .env file found. Create one first.');
        return;
    }

    const loadEntries = () => {
        return fs.readFileSync(ENV_FILE, 'utf8')
            .split('\n')
            .filter(line => line.includes('=') && !line.startsWith('#'))
            .map(line => {
                const eqIdx = line.indexOf('=');
                return { key: line.slice(0, eqIdx), value: line.slice(eqIdx + 1) };
            });
    };

    let entries = loadEntries();
    let selected = 0;
    let editing = false;
    let editBuffer = '';

    let renderedLines = 0;
    const render = () => {
        let output = '  🧚 mylia — Settings\n\n';
        output += '  ↑/↓ navigate  •  Enter to edit  •  Esc/q to exit\n\n';

        for (let i = 0; i < entries.length; i++) {
            const { key, value } = entries[i];
            const cursor = i === selected ? '\x1b[36m ❯ \x1b[0m' : '   ';
            const displayValue = key.includes('TOKEN') || key.includes('API_KEY')
                ? (value ? '••••••••' : '(empty)')
                : (value || '(empty)');

            if (editing && i === selected) {
                output += `${cursor}\x1b[1m${key}\x1b[0m = \x1b[33m${editBuffer}\x1b[0m▌\n`;
            } else {
                output += `${cursor}\x1b[1m${key}\x1b[0m = ${displayValue}\n`;
            }
        }

        if (editing) {
            output += '\n  Type new value and press Enter to save, Esc to cancel\n';
        }

        if (renderedLines > 0) {
            readline.moveCursor(process.stdout, 0, -renderedLines);
        }
        readline.cursorTo(process.stdout, 0);
        process.stdout.write('\x1b[J');

        process.stdout.write(output);
        renderedLines = output.split('\n').length - 1;
    };

    const saveEntry = () => {
        entries[selected].value = editBuffer;
        writeEnvValue(entries[selected].key, editBuffer);
        editing = false;
        render();
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    render();

    process.stdin.on('data', (key) => {
        if (editing) {
            if (key === '\x1b' || key === '\x1b[') {
                // Esc — cancel editing
                editing = false;
                render();
            } else if (key === '\r' || key === '\n') {
                // Enter — save
                saveEntry();
            } else if (key === '\x7f' || key === '\b') {
                // Backspace
                editBuffer = editBuffer.slice(0, -1);
                render();
            } else if (key >= ' ' && !key.startsWith('\x1b')) {
                // Regular character
                editBuffer += key;
                render();
            }
            return;
        }

        // Navigation mode
        if (key === '\x1b[A') {
            // Up arrow
            selected = Math.max(0, selected - 1);
            render();
        } else if (key === '\x1b[B') {
            // Down arrow
            selected = Math.min(entries.length - 1, selected + 1);
            render();
        } else if (key === '\r' || key === '\n') {
            // Enter — start editing
            editing = true;
            editBuffer = entries[selected].value;
            render();
        } else if (key === 'q' || key === '\x1b' || key === '\x03') {
            // q, Esc, Ctrl+C — exit
            if (renderedLines > 0) {
                readline.moveCursor(process.stdout, 0, -renderedLines);
                readline.cursorTo(process.stdout, 0);
                process.stdout.write('\x1b[J');
            }
            console.log('Settings saved. ✨');

            const pid = getSavedPid();
            if (pid && isRunning(pid)) {
                console.log('Restarting mylia to apply changes...');
                stop();
                setTimeout(start, 500);
            }

            process.exit(0);
        }
    });
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

const help = () => {
    console.log(`
  🧚 mylia — CLI

  Usage:
    mylia start              Start the daemon
    mylia stop               Stop the daemon
    mylia status             Show running status, provider, and model
    mylia logs               Tail the live console output
    mylia config             Interactive settings editor
    mylia install-skill <url> Install a ClawHub skill from a Git repository
`);
};

switch (command) {
    case 'start': start(); break;
    case 'stop': stop(); break;
    case 'status': status(); break;
    case 'logs': logs(); break;
    case 'config':
    case 'configure':
    case 'settings': configure(); break;
    case 'install-skill':
    case 'install': installSkill(arg); break;
    default: help(); break;
}
