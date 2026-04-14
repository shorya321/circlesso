---
description: Code review — review uncommitted changes for quality, security, and correctness
---

# Code Review

## Gather Changes
```bash
git diff --stat
git diff --name-only
```
Read each modified file.

## Review Checklist

### Security (CRITICAL)
- [ ] No hardcoded secrets (API keys, tokens, passwords)
- [ ] All user input validated with Zod
- [ ] Auth0 session checked on all API routes
- [ ] No secrets in client-side code
- [ ] Password ticket URLs not logged

### Code Quality (HIGH)
- [ ] Functions are small (<50 lines)
- [ ] Files are focused (<400 lines)
- [ ] Error handling at every level
- [ ] TypeScript strict mode — no `any`
- [ ] Immutable patterns used (no mutation)

### Auth0/Circle API (HIGH)
- [ ] M2M token cached properly
- [ ] Rate limits respected (200ms delay in bulk ops)
- [ ] Error responses handled (409, 429, 401, 404)
- [ ] Correct base URLs and auth headers

### Testing (MEDIUM)
- [ ] Tests exist for new functionality
- [ ] Tests actually test behavior (not just coverage)
- [ ] Edge cases covered (duplicate user, API failure, missing fields)

### Performance (LOW)
- [ ] No unnecessary API calls
- [ ] Auth0 user-by-email lookup batched where possible
- [ ] No blocking operations in API routes

## Report Format
For each issue found:
- **Severity**: CRITICAL / HIGH / MEDIUM / LOW
- **File:Line**: location
- **Issue**: what's wrong
- **Fix**: suggested change
