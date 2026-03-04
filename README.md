<div align="center">

# 🧚‍♀️ mylia

### ✦ My Little AI ✦

> *A minimalist, lightweight AI agent framework.*

**mylia** is designed to provide only the bare minimum required for a functional, persistent AI agent, keeping dependencies as low as possible.<br>
Heavily inspired by the philosophy of **OpenClaw**, `mylia` focuses on core agent functionalities without the unnecessary bloat.

</div>

---

## 🎯 Core Objectives

The framework is built around efficiently achieving exactly five essential capabilities:

1. **💬 Messaging-to-LLM**: Seamless, uninterrupted communication with large language models.
2. **🎭 Agent Customisation**: Simple and direct configuration of the agent's identity and instructions.
3. **⏱️ External Triggers & Heartbeat**: The ability to be invoked proactively or run on established intervals.
4. **🧠 Persistent Memory**: Long-term user fact retention and comprehensive session-based conversation histories.
5. **🧰 Tool Calling**: Extensible and reliable tool execution for interacting natively with the host system.

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
