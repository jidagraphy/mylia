---
name: system_check
description: Check the host machine's health — disk usage, memory, CPU load, and uptime. Use when the user asks how their system is doing, wants a status report, or mentions anything about storage, RAM, or performance.
---

# System Check

Report on the host machine's current health using a few lightweight shell commands.

## When to Use

The user asks about their system, machine status, disk space, memory, CPU, or uptime — even casually (e.g. "is my mac okay?", "am I running low on space?").

## Steps

1. Run these commands via `execute_shell`, all in one call to keep it quick:

```bash
echo "=== Uptime ===" && uptime && echo "\n=== Disk Usage ===" && df -h / && echo "\n=== Memory ===" && vm_stat | head -10 && echo "\n=== CPU Load ===" && sysctl -n vm.loadavg
```

2. Parse the output and present a concise, human-friendly summary. Don't dump raw output — translate it:
   - **Uptime**: how long the machine has been on, in plain language
   - **Disk**: used / total and percentage for the main volume
   - **Memory**: approximate usage (vm_stat reports in 4096-byte pages — multiply by 4096 and convert to GB)
   - **CPU load**: 1/5/15 min averages, note if anything looks high

3. If anything looks concerning (disk >85% full, high load average relative to core count), flag it. Otherwise, just say things look healthy.

## Notes

- This assumes macOS. The commands (`vm_stat`, `sysctl`) are Mac-specific. If a command fails, skip that section and note it rather than erroring out.
- Keep the summary short — a few lines, not a wall of text.
