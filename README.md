<div align="center">

# 🧚‍♀️ mylia

### ✦ My Little AI ✦

> *A minimalist, lightweight AI agent framework.*

**mylia** is designed to provide only the bare minimum required for a functional, persistent AI agent, keeping dependencies as low as possible.<br>
Heavily inspired by the philosophy of **OpenClaw**, `mylia` focuses on core agent functionalities without the unnecessary bloat.

</div>

---
## 🛠️ Announcements

This is a work in progress project! Currently only Gemini API and ollama are supported.
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

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) installed on your host system.

### Installation

1. Copy the `.env.example` or create your own `.env` file at the root.
2. Populate the `.env` file with your appropriate environment variables (e.g., Discord Bot Token, API keys).
3. Install the minimal required dependencies:
   ```bash
   npm install
   ```

### Running the Agent

You can start the agent directly with Node.js, or manage it in the background using a process manager like `pm2`:

```bash
# Standard run
node index.js

# Running with pm2 for background execution
pm2 start index.js --name mylia
```

---

## 📂 Directory Structure

- **`AgentTemplate/`**: Default templates for `agent.md` and `memory.md` identities.
- **`Agent/`**: Active directory where the agent's identity, long-term memory, and session histories are stored.
- **`Tools/`**: Modular tool files that the LLM can invoke.
- **`Utility/`**: Helper scripts for session management, memory compaction, and initialization.
- **`Clients/`**: Provider wrappers (e.g., Gemini API, Discord Client).

---

## ⚠️ Disclaimer

**Note:** This project is actively in development and primarily made for personal use. It is still in its early stages. Please exercise caution if adapting it for wider or production environments.
