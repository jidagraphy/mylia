<div align="center">

# 🧚‍♀️ mylia

### ✦ My Little AI ✦

> *A lightweight AI agent harness for Discord.*

**mylia** (pronounced 'maria' or '마리아') gives you a self-hosted AI agent that runs in Discord. It comes with persistent memory, shell access, file editing, scheduled tasks, and an extensible skill system — all in a minimal, low-dependency package.

</div>

---
## Announcements

This is a work in progress project! Currently only openrouter, ollama and Gemini API are supported.
I welcome any feedback and suggestions!

---

## Core Features

The framework is built around efficiently achieving a few fundemental capabilities:

1. **Messaging-to-LLM**
2. **Agent Customisation**
3. **Scheduled Tasks**
4. **Persistent Memory**
5. **Tools**
6. **Skills**

---


## Getting Started

### 1. Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a new application.
2. Go to **Bot** and click **Reset Token** to get your bot token. Save it for later.
3. Under **Bot**, turn **off** "Public Bot" (so only you can add it to servers).
4. Under **Bot > Privileged Gateway Intents**, turn **on** "Message Content Intent".
5. Go to **OAuth2 > URL Generator**, select the `bot` scope, and invite the bot to your server.

### 2. Choose an AI Provider

mylia supports three providers. Pick one and grab an API key:

| Provider | Where to get a key | Notes |
|----------|-------------------|-------|
| **Gemini** | [aistudio.google.com](https://aistudio.google.com/app/apikey) | Google's native API. Generous free tier, including free access to Gemma models. |
| **OpenRouter** | [openrouter.ai/keys](https://openrouter.ai/keys) | Unified gateway to many models. Some are free, others paid. |
| **Ollama** | Run locally — [ollama.com](https://ollama.com) | No API key, no cost. Needs a capable machine. |

**Recommended model: Gemma 4 31B (instruction-tuned).** It's basically free and handles general chat, fact lookup, and light coding well. Example model strings per provider:

| `AI_PROVIDER` | `AI_MODEL` |
|---------------|------------|
| `gemini` | `gemma-4-31b-it` |
| `openrouter` | `google/gemma-4-31b-it:free` |
| `ollama` | `gemma4:31b` |

Of course you can use any other model the provider supports — set it in `config.json` after install.

### 3. Install mylia

```bash
npm install -g @jidagraphy/mylia
```

On first run it creates a workspace at `~/.mylia/` with default config and templates.

### 4. Configure

```bash
mylia config
```

Set your `DISCORD_BOT_TOKEN` (from step 1) and your AI provider's API key. You can also edit `~/.mylia/config.json` directly.

### 5. Run

```bash
mylia start               # Start as background daemon
mylia stop                # Stop the daemon
mylia restart              # Restart
mylia status              # Show status, provider, and model
mylia logs                # Tail live output
mylia config              # Edit settings
mylia install-skill <url>  # Install a skill from GitHub
```

Once running, mention the bot in Discord to chat. Use `/new` to start a fresh session.

---

## Workspace (`~/.mylia/`)

| File / Folder | Purpose |
|---------------|---------|
| `agent.md` | System prompt — the AI's boundaries and instructions |
| `soul.md` | Personality and tone |
| `user.md` | Info about the primary user |
| `memory.md` | Persistent long-term memory |
| `config.json` | API keys, provider, model, and settings |
| `Memory/` | Auto-generated session diaries |
| `Sessions/` | Active connection states |
| `Skills/` | Installed skill packages |

---

## Skills

Skills are instruction packages that extend what mylia can do. Each skill is a folder in `Skills/` with a `SKILL.md` containing YAML frontmatter and markdown instructions. They're auto-discovered and listed in the agent's system prompt.

You can ask mylia to create a skill for you (it ships with `skill-creator`), or install one from GitHub:

```bash
mylia install-skill <github-repo-url>
```

> **Warning:** Skills can instruct the agent to run shell commands and modify files. Review any skill before installing.

---

## Tools

| Tool | Description |
|------|-------------|
| `execute_shell` | Run shell commands on the host (configurable timeout) |
| `web_fetch` | Fetch a web page as clean text |
| `read_file` | Read any file |
| `edit_file` | Edit a file (auto-backs up to `.bak`) |
| `view_image` | Load an image for vision-capable models |
| `send_attachment` | Attach a file to the next Discord reply |
| `view_skill` | Read a skill's instructions |
| `compact_history` | Summarize the current session into a diary |
| `create_cron` | Schedule a prompt on a cron or one-shot schedule |
| `list_crons` | List all scheduled entries |
| `delete_cron` | Delete a scheduled entry |

Tools can be disabled individually via `disabled_tools` in `config.json`.

---

## Disclaimer

This project is in active development and primarily made for personal use. Exercise caution if adapting for production.

---

## License

[MIT License](LICENSE)
