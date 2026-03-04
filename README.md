<div align="center">

# 🧚‍♀️ mylia

### ✦ My Little AI ✦

> *A minimalist, lightweight AI agent framework.*

**mylia** is designed to provide only the bare minimum required for a functional, persistent AI agent, keeping dependencies as low as possible.<br>
Heavily inspired by the philosophy of **OpenClaw**, `mylia` focuses on core agent functionalities without the unnecessary bloat.

</div>

---
## 🛠️ Announcements

This is a work in progress project! Currently only openrouter, ollama and Gemini API are supported.
I welcome any feedback and suggestions!

---

## 🎯 Core Objectives

The framework is built around efficiently achieving exactly five essential capabilities:

1. **Messaging-to-LLM**
2. **Agent Customisation**
3. **External Triggers & Heartbeat**
4. **Persistent Memory**
5. **Tool Calling**

---


## �🚀 Getting Started

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
mylia config                # Interactive settings editor
```

Or run directly without the CLI:

```bash
node app.js
```

---

## 📂 Directory Structure

- **`AgentTemplate/`**: Default templates copied into new workspaces.
- **`Workspace (default: ~/.mylia/)`**: Agent identity, long-term memory, and session histories.
- **`Tools/`**: Modular tool files that the LLM can invoke.
- **`Utility/`**: Helper scripts for session management, memory, and workspace setup.
- **`Clients/`**: Provider wrappers (e.g., Gemini API, Ollama, OpenRouter, Discord).

---

## � Tools

- **`executeShell`** — Runs shell commands on the host machine and returns the output.
- **`webFetch`** — Fetches a web page and returns clean text with all HTML, JS, and CSS stripped.
- **`updateMemory` / `updateSoul` / `updateUser`** — Rewrites the agent's long-term memory, personality, or user profile files.

---

## ⚠️ Disclaimer

**Note:** This project is actively in development and primarily made for personal use. It is still in its early stages. Please exercise caution if adapting it for wider or production environments.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
