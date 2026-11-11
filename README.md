<div align="center">

# 🧚‍♀️ mylia

### ✦ My Little AI ✦

> *A lightweight AI agent harness for Discord.*

**mylia** (pronounced 'maria' or '마리아') gives you a self-hosted AI agent that runs in Discord. It comes with persistent memory, shell access, file editing, scheduled tasks, and an extensible skill system — all in a minimal, low-dependency package.

</div>

---
## Announcements

This is a work in progress project! Currently OpenRouter, Ollama, Gemini API and Claude Code (via your own `claude` login) are supported.
I welcome any feedback and suggestions!

---

## What's New

**🧪 Claude Code as the AI engine (testing).** mylia can now use a locally installed, logged-in [Claude Code](https://code.claude.com/docs) as its AI engine (`"AI_PROVIDER": "claudecode"`). Claude Code brings its own tools (shell, files, web search) and keeps its own conversation history, so it behaves a little differently from the API providers. See [Claude Code provider](#claude-code-provider).

This is still in a testing stage. It runs on your own Claude subscription, so use it in line with Anthropic's [terms](https://code.claude.com/docs/en/legal-and-compliance) and [usage policy](https://www.anthropic.com/legal/aup): a personal bot for yourself, not a service for other people.

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

mylia supports four providers. Pick one and grab an API key:

| Provider | Where to get a key | Notes |
|----------|-------------------|-------|
| **Gemini** | [aistudio.google.com](https://aistudio.google.com/app/apikey) | Google's native API. Generous free tier, including free access to Gemma models. |
| **OpenRouter** | [openrouter.ai/keys](https://openrouter.ai/keys) | Unified gateway to many models. Some are free, others paid. |
| **Ollama** | Run locally — [ollama.com](https://ollama.com) | No API key, no cost. Needs a capable machine. |
| **Claude Code** | No key — [install Claude Code](https://code.claude.com/docs) and log in with `claude` | Uses your Claude plan. Works differently from the others; see [Claude Code provider](#claude-code-provider). |

**Recommended model: Gemma 4 31B (instruction-tuned).** It's basically free and handles general chat, fact lookup, and light coding well. Example model strings per provider:

| `AI_PROVIDER` | `AI_MODEL` |
|---------------|------------|
| `gemini` | `gemma-4-31b-it` |
| `openrouter` | `google/gemma-4-31b-it:free` |
| `ollama` | `gemma4:31b` |
| `claudecode` | `sonnet` (or `opus`, `haiku`, or a full model id) |

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

Add your Discord user ID to `OWNER_IDS` — mylia ignores everyone else, and ignores everyone if the list is empty. To get your ID: Discord **Settings > Advanced > Developer Mode**, then right-click your name > **Copy User ID**. IDs must be strings: `"OWNER_IDS": ["123456789012345678"]`.

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
| `agent-claudecode.md` | Used instead of `agent.md` with the Claude Code provider |
| `soul.md` | Personality and tone |
| `user.md` | Info about the primary user |
| `memory.md` | Persistent long-term memory |
| `config.json` | API keys, provider, model, and settings |
| `Memory/` | Auto-generated session diaries |
| `Sessions/` | Active connection states |
| `Skills/` | Installed skill packages |
| `claude_sessions.json` | Claude Code provider only: which Claude session belongs to which mylia session |

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
| `edit_file` | Append to a file, or replace an exact text match (auto-backs up to `.bak`) |
| `view_image` | Load an image for vision-capable models |
| `send_attachment` | Attach a file to the next Discord reply |
| `view_skill` | Read a skill's instructions |
| `compact_history` | Summarize the current session into a diary |
| `search_memory` | Keyword search over past diaries and chat logs in the current channel/DM |
| `create_cron` | Schedule a prompt on a cron or one-shot schedule |
| `list_crons` | List all scheduled entries |
| `delete_cron` | Delete a scheduled entry |

Tools can be disabled individually via `disabled_tools` in `config.json`.

---

## Scheduled Tasks

Crons live in `~/.mylia/crons.json` and are created with the `create_cron` tool (or by editing the file — it is re-read on every tick, so no restart is needed).

```json
{
  "id": "cron_1793801995901",
  "type": "cron",
  "schedule": "0 23 * * *",
  "timezone": "Asia/Seoul",
  "channelId": "123456789012345678",
  "prompt": "Send me today's spending report.",
  "includeHistory": true,
  "historyCharBudget": 10000,
  "enabled": true
}
```

| Field | Description |
|-------|-------------|
| `schedule` | Cron expression, or an ISO timestamp for a one-shot (`type: "at"`) |
| `timezone` | IANA timezone for cron expressions; defaults to the system timezone |
| `channelId` | Discord channel the result is posted to |
| `prompt` | What the agent receives when the cron fires |
| `includeHistory` | `false` (default): run with no chat history. `true`: include the channel's session history |
| `model` | Optional. Model for this cron only, overriding `AI_MODEL` (same provider) |
| `historyCharBudget` | Optional, only with `includeHistory: true`. Characters of history for this cron, overriding `agent.historyCharBudget` in `config.json` (the window used for normal chat). Use a small value when a job only needs its own recent reports |

---

## Claude Code provider

With `"AI_PROVIDER": "claudecode"`, mylia runs each message through the official `claude` CLI in headless mode (`claude -p`), signed in with your own Claude account. mylia still handles Discord, crons, sessions, diaries and your persona files; Claude Code does the thinking **and runs its own tools**.

> **Testing stage.** Expect rough edges. Use it as a personal bot on your own account, in line with Anthropic's [terms for Claude Code](https://code.claude.com/docs/en/legal-and-compliance).

### Requirements

- **A paid Claude plan** (Pro, Max, …). Setting `ANTHROPIC_API_KEY` in mylia's environment should switch to pay-as-you-go API billing instead (untested).
- **Claude Code installed and logged in** on the same machine and user account that runs mylia. Run `claude` once and log in.
- **A recent Claude Code version.** mylia relies on `--system-prompt-snapshot`, `--setting-sources` and `--output-format stream-json`. Tested with Claude Code **2.1.283** on macOS; the headless flags were also checked on **2.1.322** on a Raspberry Pi. Older versions may lack these flags.
- **Logins expire.** The Claude login is refreshed automatically, but it can still expire, e.g. after a long time offline. mylia then replies with a Claude Code login error. Run `claude` on that machine, log in again, and restart mylia. `claude auth status` shows the current state.
- **Shared usage limits.** mylia's messages and crons count against the same plan limits as your own Claude and Claude Code use. Crons on a smaller model (`"model": "haiku"` or `"sonnet"`) save usage.

### Configuration

```json
"AI_PROVIDER": "claudecode",
"AI_MODEL": "sonnet",
"CLAUDE_CODE_BIN": "claude",
"CLAUDE_CODE_TIMEOUT_SECONDS": 600
```

`CLAUDE_CODE_BIN` and `CLAUDE_CODE_TIMEOUT_SECONDS` are optional. Set `CLAUDE_CODE_BIN` to a full path (e.g. `/home/you/.local/bin/claude`) if mylia starts somewhere `claude` isn't on `PATH`, such as an `@reboot` crontab line. `mylia start` checks that `claude` is installed and logged in.

### How it differs from the API providers

| | Gemini / OpenRouter / Ollama | Claude Code |
|---|---|---|
| Tools | mylia's tools ([Tools](#tools)), run by mylia | Claude Code's own (Bash, Read, Edit, Grep, WebFetch, WebSearch…); mylia's tool list isn't sent |
| Conversation history | mylia replays the session log each message | Claude Code keeps the conversation (`--resume`); mylia sends only the new message |
| Instructions | `agent.md` | `agent-claudecode.md` (crons, memory and skills are edited as plain files) |
| Live tool lines in Discord | Yes | Yes |
| Billing | API key / free tier | Your Claude plan's usage limits |
| Sending files to Discord | `send_attachment` | Not supported |

- **Sessions:** each mylia session maps to one Claude Code session. `/new` (or the idle timeout) starts a fresh one; diaries are still written from mylia's own log.
- **Crons:** `includeHistory: false` runs fresh; `true` continues that channel's Claude session. Set `"model"` on a cron to run it on a cheaper model.
- **Isolation:** runs ignore your own Claude Code settings (global `CLAUDE.md`, hooks, plugins), so your personal setup doesn't leak into the persona. Claude Code's own auto-memory is off; `memory.md` stays the only memory. The working directory is `~/.mylia/`.
- **Permissions:** runs use Claude Code's `auto` permission mode, where a classifier blocks risky actions. Failed runs are never retried automatically, since they may already have run commands.
- **Terms:** this is meant for one person using their own subscription. Don't let other people use a bot that runs on your Claude login.

---

## Disclaimer

This project is in active development and primarily made for personal use. Exercise caution if adapting for production.

---

## License

[MIT License](LICENSE)
