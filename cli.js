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

// ── Helpers ──

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

// ── First-Run Setup ──

const ENV_TEMPLATE = path.join(APP_DIR, '.env.template');
const rl = require('readline');
const os = require('os');

const ensureSetup = async () => {
    // 1. Ensure .env exists
    if (!fs.existsSync(ENV_FILE)) {
        if (fs.existsSync(ENV_TEMPLATE)) {
            fs.copyFileSync(ENV_TEMPLATE, ENV_FILE);
            console.log('Created .env from .env.template');
        } else {
            console.error('No .env or .env.template found. Cannot continue.');
            process.exit(1);
        }
    }

    // 2. Load env values
    require('dotenv').config({ path: ENV_FILE, override: true });

    // 3. Check workspace path
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
};

// ── Commands ──

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

    const render = () => {
        // Clear screen and move to top
        process.stdout.write('\x1b[2J\x1b[H');
        console.log('  🧚 mylia — Settings\n');
        console.log('  ↑/↓ navigate  •  Enter to edit  •  Esc/q to exit\n');

        for (let i = 0; i < entries.length; i++) {
            const { key, value } = entries[i];
            const cursor = i === selected ? '\x1b[36m ❯ \x1b[0m' : '   ';
            const displayValue = key.includes('TOKEN') || key.includes('API_KEY')
                ? (value ? '••••••••' : '(empty)')
                : (value || '(empty)');

            if (editing && i === selected) {
                console.log(`${cursor}\x1b[1m${key}\x1b[0m = \x1b[33m${editBuffer}\x1b[0m▌`);
            } else {
                console.log(`${cursor}\x1b[1m${key}\x1b[0m = ${displayValue}`);
            }
        }

        if (editing) {
            console.log('\n  Type new value and press Enter to save, Esc to cancel');
        }
    };

    const saveEntry = () => {
        entries[selected].value = editBuffer;
        writeEnvValue(entries[selected].key, editBuffer);
        editing = false;
        render();
    };

    // Enable raw mode for arrow key input
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
            process.stdout.write('\x1b[2J\x1b[H');
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

// ── Router ──

const help = () => {
    console.log(`
  🧚 mylia — CLI

  Usage:
    mylia start              Start the daemon
    mylia stop               Stop the daemon
    mylia status             Show running status, provider, and model
    mylia logs               Tail the live console output
    mylia config             Interactive settings editor
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
    default: help(); break;
}
