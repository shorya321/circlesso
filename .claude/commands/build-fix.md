---
description: Diagnose and fix build or type errors one at a time with minimal changes
---

# Build and Fix

## Step 1: Detect Errors
```bash
npm run build 2>&1
```
If build succeeds, also run:
```bash
npx tsc --noEmit 2>&1
```

## Step 2: Parse and Group Errors
- Group errors by file
- Sort by dependency order (fix upstream errors first)
- Identify root causes vs cascading errors

## Step 3: Fix Loop
For each error (one at a time):
1. Read the file containing the error
2. Diagnose the root cause
3. Apply the minimal fix (do NOT refactor surrounding code)
4. Re-run `npm run build` to verify
5. Move to next error

## Step 4: Guardrails
STOP and ask the user if:
- More than 10 files need changes
- A fix requires architectural changes
- You're unsure about the correct fix
- The same error keeps recurring after 3 attempts

## Step 5: Summary
Report:
- Errors found: X
- Errors fixed: Y
- Files modified: list
- Build status: PASS/FAIL

## Recovery
If stuck, try:
```bash
rm -rf .next && npm run build
```
```bash
rm -rf node_modules && npm install && npm run build
```
