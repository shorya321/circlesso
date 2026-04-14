---
description: Run full verification — build, tests, lint, and feature list audit
---

# Verification Loop

Run all checks to confirm the project is in a clean state.

## Steps

### 1. Type Check
```bash
npx tsc --noEmit
```
Fix any type errors before proceeding.

### 2. Build
```bash
npm run build
```
Build must succeed with zero errors.

### 3. Lint
```bash
npm run lint
```
Fix any lint errors.

### 4. Tests
```bash
npm test
```
All tests must pass.

### 5. Feature List Audit
Read `feature-list.json` and verify:
- Every feature marked `passes: true` actually has its implementation complete
- No feature is marked as passing when its code is a stub (throws "Not implemented")
- Features are numbered sequentially with no gaps

### 6. Dev Server Smoke Test
```bash
curl -s http://localhost:3001 | head -5
curl -s http://localhost:3001/api/circle/members
curl -s http://localhost:3001/api/circle/access-groups
```

### 7. Report
Output a summary:
- Build: PASS/FAIL
- Tests: X passing, Y failing
- Lint: PASS/FAIL
- Features: X/20 complete
- Any issues found

## When to Use
- Before committing
- After implementing a feature
- At the start of a session to verify prior work
- Before creating a PR
