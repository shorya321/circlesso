---
description: Bootstrap a new agent session — read progress, check feature list, start dev server
---

# Session Initialization

Run this at the start of every coding session.

## Steps

1. **Orient**
   ```bash
   pwd
   ```
   Confirm you are in `/Volumes/shorya/apps/circleso`

2. **Read progress log**
   Read `claude-progress.txt` to understand what was done in prior sessions.

3. **Read feature list**
   Read `feature-list.json` and identify the highest-priority feature where `passes` is `false`.

4. **Check git history**
   ```bash
   git log --oneline -10
   ```

5. **Start dev server**
   ```bash
   bash init.sh
   ```
   Wait for "Server is ready" message.

6. **Smoke test**
   ```bash
   curl -s http://localhost:3001 | head -20
   ```
   Verify the server responds.

7. **Report**
   Tell the user:
   - Current project state (how many features done vs total)
   - What feature you'll work on next
   - Any blockers or issues from prior sessions

## Important
- Do NOT start implementing until you've completed all 7 steps
- Do NOT skip reading the progress log — it contains critical context
- Pick only ONE feature to implement per session
