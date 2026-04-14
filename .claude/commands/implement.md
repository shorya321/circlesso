---
description: Implement the next incomplete feature from feature-list.json following TDD and the agent harness protocol
argument-hint: [feature-id like F005, or blank for next priority]
---

# Feature Implementation

Implement a single feature from `feature-list.json`.

## Feature Selection

If `$ARGUMENTS` is provided, implement that specific feature ID (e.g., F005).
Otherwise, pick the highest-priority feature where `passes` is `false`.

## Implementation Workflow

### Phase 1: Understand
1. Read the feature's `description` and `steps` from `feature-list.json`
2. Read any related files that will be modified
3. Understand the existing code patterns before writing new code

### Phase 2: Test First (TDD)
4. Write a failing test for the feature (RED)
5. Run the test — confirm it fails
   ```bash
   npm test -- --testPathPattern="<test-file>"
   ```

### Phase 3: Implement (GREEN)
6. Write the minimal implementation to make the test pass
7. Run the test — confirm it passes
8. Run the full test suite to ensure no regressions
   ```bash
   npm test
   ```

### Phase 4: Verify
9. Walk through each `step` in the feature's steps array
10. Verify each step passes manually or via test
11. Run build to catch type errors:
    ```bash
    npm run build
    ```

### Phase 5: Complete
12. Mark the feature as passing in `feature-list.json`:
    - ONLY change `"passes": false` to `"passes": true`
    - Do NOT edit any other fields
13. Git commit with descriptive message:
    ```
    feat: implement F0XX — <feature description>
    ```
14. Append a summary to `claude-progress.txt`

## Rules
- Implement ONE feature at a time — never skip ahead
- If a feature depends on an unimplemented feature, implement the dependency first
- If you encounter a bug in a prior feature, fix it before continuing
- Leave the codebase in a clean, building state after every feature
- NEVER remove or edit feature descriptions — only change the `passes` field
