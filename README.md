<div align="center">

# 🧚‍♀️ mylia

### ✦ My Little AI ✦

> *A minimalist, lightweight AI agent framework.*

**mylia** (pronounced 'maria' or '마리아')is designed to provide only the bare minimum required for a functional, persistent AI agent, keeping dependencies as low as possible.<br>
Heavily inspired by the philosophy of **OpenClaw**, `mylia` focuses on core agent functionalities without the unnecessary bloat.

</div>

---
## Announcements

This is a work in progress project! Currently only openrouter, ollama and Gemini API are supported.
I welcome any feedback and suggestions!

---

## Core Objectives

The framework is built around efficiently achieving a few fundemental capabilities:

1. **Messaging-to-LLM**
2. **Agent Customisation**
3. **External Triggers & Heartbeat**
4. **Persistent Memory**
5. **Tools**
6. **Skills**

---


## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) installed on your host system.

### Installation

The easiest way to install and run mylia is via npm:

```bash
npm install -g @jidagraphy/mylia
```

On your first run, it will auto-create your configuration folder and prompt you for a workspace path (default: `~/.mylia`) where all agent data is stored.

**Important:** Before starting the agent, you must configure your API keys:
```bash
mylia config
```
This will open an interactive menu to set your `DISCORD_BOT_TOKEN` and your chosen AI provider's API key.

*(Alternatively, to run from source, clone the repo, run `npm install`, and use `npm link` to make the CLI available.)*

### Running the Agent

Use the built-in CLI to manage mylia from anywhere:

```bash
# Daemon management
mylia start              # Start as background daemon
mylia stop               # Stop the daemon
mylia restart            # Stop and restart the daemon
mylia status             # Show running status, provider, and model
mylia logs               # Tail live console output

# Configuration
mylia config             # Interactive settings editor

# Skills
mylia install-skill <github-repo-url>  # Install a skill
```

Or run directly without the CLI:

```bash
node app.js
```

### Discord Slash Commands

Once the bot is running and invited to your server, the following slash commands are available:

| Command | Description |
|---------|-------------|
| `/new`  | Saves the current session as a diary and starts a fresh session with a greeting |

---

## Directory Structure

- **`WorkspaceTemplate/`**: Default templates to be copied to the workspace on first run.
- **`Tools/`**: Modular tool files that the LLM can invoke.
- **`Utility/`**: Helper scripts for session management, memory, and workspace setup.
- **`Clients/`**: Provider wrappers (e.g., Gemini API, Ollama, OpenRouter, Discord).

---

## Workspace Structure (default: `~/.mylia/`)

- **`agent.md`**: Core system prompt framing the AI's boundaries.
- **`memory.md`**: Persistent long term memory facts.
- **`soul.md`**: Core personality and tone definition.
- **`user.md`**: Profile data concerning the primary user.
- **`crons.json`**: Scheduled cron entries (auto-created by the `create_cron` tool).
- **`.latest_context`**: Debug dump of the last built system prompt. Open to see exactly what the AI is seeing.
- **`Memory/`**: Stores auto-generated session diaries summarizing past conversations.
- **`Sessions/`**: Active connection states.
- **`Skills/`**: Installed skill packages. Each subfolder contains a `SKILL.md` with instructions the agent follows.

---

## Skills

Skills are self-contained instruction packages that extend what mylia can do. Each skill is a folder inside `Skills/` with a `SKILL.md` file containing YAML frontmatter and markdown instructions. Skills are auto-discovered and listed in the agent's system prompt — when a user request matches a skill, the agent reads its instructions and follows them.

### Default Skills

mylia ships with one built-in skill, copied to your workspace on first run:

| Skill | Description |
|-------|-------------|
| `skill-creator` | Creates new skills on demand. Ask mylia to make a skill and it will scaffold the folder, write the SKILL.md, and verify it. |

### Creating Skills

You can ask mylia to create a skill for you (it will use `skill-creator`), or create one manually:

```
Skills/
└── my-skill/
    └── SKILL.md
```

```markdown
---
name: my-skill
description: What it does and when to use it.
---

Instructions for the agent to follow.
```

Skill names use `kebab-case` (lowercase with hyphens) for both the folder and the `name` field.

### Installing Skills

You can install skills directly from any GitHub repository:

```bash
mylia install-skill <github-repo-url>
```

> **Warning:** Do not install untrusted skills. Skills can instruct the agent to run shell commands and modify files. You are responsible for reviewing any skill you install.

---

## Tools

- **`execute_shell`** — Runs shell commands on the host machine and returns the output (30s timeout). Commands run from the user's home directory (`~`) by default.
- **`web_fetch`** — Fetches a web page and returns clean text with all HTML, JS, and CSS stripped.
- **`read_file`** — Reads any file. Used to inspect memory, soul, user profile, session diaries, etc.
- **`edit_file`** — Edits a file by replacing its content. Automatically backs up the existing file to `.bak` and returns the previous content.
- **`view_image`** — Loads an image file from disk (png, jpg, gif, webp, bmp, heic) and attaches it to the next turn so a vision-capable model can see it. Pairs well with `execute_shell screencapture` for on-screen inspection.
- **`send_attachment`** — Queues a local file or image (up to 25MB) to be attached to the agent's next Discord reply. Can be called multiple times in one turn to send multiple files together.
- **`view_skill`** — Reads the instructions for an installed skill.
- **`compact_history`** — Summarizes the current session into a diary file.
- **`create_cron`** — Schedules a prompt to run through the agent at a specific time or on a recurring schedule, with the reply delivered to a chosen Discord channel. Accepts either a 5-field cron expression (`0 9 * * *`) or an ISO 8601 timestamp for one-shot schedules. Optional IANA timezone.
- **`list_crons`** — Lists all scheduled cron entries with their schedule, target channel, prompt, and next computed fire time.
- **`delete_cron`** — Deletes a scheduled cron entry by id.

---

## Disclaimer

**Note:** This project is actively in development and primarily made for personal use. It is still in its early stages. Please exercise caution if adapting it for wider or production environments.

---

## License

This project is licensed under the [MIT License](LICENSE).
