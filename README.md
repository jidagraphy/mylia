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
- **`Memory/`**: Stores auto-generated session diaries summarizing past conversations.
- **`Sessions/`**: Active connection states.
- **`Skills/`**: Installed skill packages. Each subfolder contains a `SKILL.md` with instructions the agent follows.

---

## Skills

Skills are self-contained instruction packages that extend what mylia can do. Each skill is a folder inside `Skills/` with a `SKILL.md` file containing YAML frontmatter and markdown instructions. Skills are auto-discovered and listed in the agent's system prompt — when a user request matches a skill, the agent reads its instructions and follows them.

### Default Skills

mylia ships with two built-in skills, copied to your workspace on first run:

| Skill | Description |
|-------|-------------|
| `skill_creator` | Creates new skills on demand. Ask mylia to make a skill and it will scaffold the folder, write the SKILL.md, and verify it. |
| `system_check` | Reports on host machine health — disk, memory, CPU load, and uptime. |

### Creating Skills

You can ask mylia to create a skill for you (it will use `skill_creator`), or create one manually:

```
Skills/
└── my_skill/
    └── SKILL.md
```

```markdown
---
name: my_skill
description: What it does and when to use it.
---

Instructions for the agent to follow.
```

Skill names use `snake_case` for both the folder and the `name` field.

### Installing Skills

You can install skills directly from any GitHub repository:

```bash
mylia install-skill <github-repo-url>
```

> **Warning:** Do not install untrusted skills. Skills can instruct the agent to run shell commands and modify files. You are responsible for reviewing any skill you install.

---

## Tools

- **`execute_shell`** — Runs shell commands on the host machine and returns the output (30s timeout).
- **`web_fetch`** — Fetches a web page and returns clean text with all HTML, JS, and CSS stripped.
- **`read_file`** — Reads any file. Used to inspect memory, soul, user profile, session diaries, etc.
- **`edit_file`** — Edits a file by replacing its content. Automatically backs up the existing file to `.bak` and returns the previous content.
- **`view_skill`** — Reads the instructions for an installed skill.
- **`compact_history`** — Summarizes the current session into a diary file.

---

## Disclaimer

**Note:** This project is actively in development and primarily made for personal use. It is still in its early stages. Please exercise caution if adapting it for wider or production environments.

---

## License

This project is licensed under the [MIT License](LICENSE).
