---
description: Show current project progress — features done, git history, and next steps
---

# Progress Report

## Steps

1. **Feature Status**
   Read `feature-list.json` and produce a table:
   | ID | Category | Description | Status |
   Show counts: X/20 complete, grouped by category.

2. **Recent Git History**
   ```bash
   git log --oneline -15
   ```

3. **Progress Log**
   Read the last entry in `claude-progress.txt`.

4. **Next Feature**
   Identify the next feature to implement (highest priority with `passes: false`).

5. **Blockers**
   Check for any issues:
   - Build errors (`npm run build 2>&1 | tail -5`)
   - Test failures (`npm test 2>&1 | tail -10`)
   - Missing env vars

6. **Report**
   Present a concise summary to the user with next recommended action.
