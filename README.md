<div align="center">

# 🧚‍♀️ mylia

### ✦ My Little AI ✦

> *A minimalist, lightweight AI agent framework.*

**mylia** (pronounced 'maria' or '마리아')is designed to provide only the bare minimum required for a functional, persistent AI agent, keeping dependencies as low as possible.<br>
Heavily inspired by the philosophy of **OpenClaw**, `mylia` focuses on core agent functionalities without the unnecessary bloat.

</div>

---
## Announcements

This is a work in progress project! Currently only openrouter, ollama and Gemini API are supported. (Gemini API is not tested yet!)
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
- **`Skills/`**: Downloaded skill repositories containing custom instructions.

---

## Skills

`mylia` supports installing [ClawHub](https://clawhub.ai)-style markdown skills. 

You can install skills directly from any GitHub repository:

```bash
mylia install-skill <github-repo-url>
```

Currently there are no default skills. You can make your own skills with the clawhub skills.md convention :
```
---
name: <skill-name>
description: <skill-description>
---
<skill-content>
```

DO NOT INSTALL UNTRUSTED SKILLS - i will NOT be responsible for any damages.

---

## Tools

- **`executeShell`** — Runs shell commands on the host machine and returns the output.
- **`webFetch`** — Fetches a web page and returns clean text with all HTML, JS, and CSS stripped.
- **`updateMemory` / `updateSoul` / `updateUser`** — Rewrites the agent's long-term memory, personality, or user profile files.

---

## Disclaimer

**Note:** This project is actively in development and primarily made for personal use. It is still in its early stages. Please exercise caution if adapting it for wider or production environments.

---

## License

This project is licensed under the [MIT License](LICENSE).
