---
name: skill-creator
description: Create new skills, modify existing skills, or help the user design a skill from scratch. Use when the user wants to make, build, add, edit, or improve a skill — even if they don't use the word "skill" explicitly. If someone describes a repeatable workflow they want you to learn, that's a skill.
---

# Skill Creator

A skill for creating new skills and iteratively improving them.

## Understanding the Request

Before writing anything, figure out what the user actually needs. The conversation may already contain enough context — if they described a workflow, used specific tools, or corrected your approach, extract that information first.

Clarify these (if not already obvious):
1. What should this skill enable you to do?
2. When should it trigger? (what kind of user request)
3. What tools will it use? (`read_file`, `edit_file`, `execute_shell`, `web_fetch`)
4. Any constraints or edge cases?

If the user has already described everything clearly, skip the interview and start drafting.

## Writing the SKILL.md

### Skill Anatomy

Every skill is a folder inside `Skills/` with a `SKILL.md` file:

```
Skills/
└── my-skill/
    └── SKILL.md
```

The `SKILL.md` has two parts: YAML frontmatter and markdown instructions.

```markdown
---
name: my-skill
description: One-line description of what it does and when to use it.
---

# My Skill

Instructions for how to perform this skill.
```

### Naming

Use `kebab-case` (lowercase with hyphens) for both the folder name and the `name` field. This follows the convention used by Claude and OpenClaw. Keep it short and descriptive.

**Examples:** `code-review`, `daily-brief`, `git-helper`, `web-scraper`

### The Description Field

The description is the primary trigger mechanism — it determines whether you recognize that a user's request matches this skill. Write it to cover:
- What the skill does
- When to use it (specific phrases, contexts, task types)

Be slightly "pushy" — err on the side of triggering. If the skill handles weather lookups, don't just say "Look up weather." Say: "Look up weather forecasts and conditions. Use when the user asks about weather, temperature, forecasts, or whether they need an umbrella — even if they don't explicitly say 'weather.'"

### Writing the Instructions

Write instructions **to yourself** — you are the one who will follow them cold, with no prior context.

**Use imperative form.** "Read the file" not "You should read the file."

**Explain the why.** Instead of rigid ALL-CAPS rules, explain reasoning so you can handle edge cases intelligently. Today's LLMs respond better to reasoned guidance than to barked commands.

Not great:
> ALWAYS read the file before editing. NEVER skip this step.

Better:
> Read the file before editing — editFile replaces the entire file content, so without reading first you'll lose everything that was already there.

**Keep it lean.** Remove instructions that aren't pulling their weight. If something is obvious or standard behavior, don't waste lines on it. Aim for under 200 lines — if you're going longer, you're probably overspecifying.

**Include examples when the output format matters:**
```markdown
## Output Format

**Example:**
Input: Added user authentication with JWT tokens
Output: feat(auth): implement JWT-based authentication
```

### Recommended Structure

Not every skill needs every section — use what fits:

```markdown
---
name: skill-name
description: What it does and when to trigger.
---

# Skill Name

Brief overview of what this skill accomplishes.

## When to Use
Trigger conditions — what kind of request activates this.

## Steps
Step-by-step instructions to follow.

## Tools Used
Which tools this skill relies on and how.

## Notes
Constraints, edge cases, or important details.
```

## Creating the Skill

1. Create the folder and file using `edit_file`:
   - Path: `Skills/<skill-name>/SKILL.md`
   - Folder name must match the `name` field in frontmatter

2. Verify with `read_file` that the file is well-formed and the frontmatter parses correctly.

3. Tell the user the skill is created and will appear in your available skills on the next message.

## Modifying an Existing Skill

If the user wants to improve a skill:

1. Use `view_skill` to read the current version.
2. Discuss what needs to change.
3. Use `edit_file` to update `Skills/<skill-name>/SKILL.md`.
4. Read it back to confirm.

When improving, think about generalization — the skill should work across many situations, not just the specific example that prompted the edit. If something keeps going wrong, try a different approach rather than adding more rigid constraints.

## Workspace Reference

Your workspace root is `~/.mylia/`. Skills live at `Skills/<skill-name>/SKILL.md`.

Available tools that skills can reference:
- `read_file` — Read any file (relative paths resolve from workspace root)
- `edit_file` — Create or overwrite a file (auto-backs up to .bak)
- `execute_shell` — Run shell commands (30s timeout, 5000 char output limit)
- `web_fetch` — Fetch and clean a URL's content
- `view_skill` — Read another skill's SKILL.md
- `compact_history` — Summarize current session and start a new one
