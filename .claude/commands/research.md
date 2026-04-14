---
description: Research current API/library docs before implementing. Fetches live documentation to avoid using outdated patterns.
argument-hint: [topic like "auth0 management api" or "circle.so admin api v2" or "resend react-email"]
---

# Research Current Documentation

Before implementing, fetch the latest docs to avoid outdated patterns.

## Topic: $ARGUMENTS

## Research Steps

### 1. Try Context7 / Ref MCP First
Use `ref_search_documentation` or `ref_read_url` to fetch current docs:

**Auth0 Management API:**
- https://auth0.com/docs/api/management/v2
- https://auth0.com/docs/api/management/v2/users/post-users
- https://auth0.com/docs/api/management/v2/tickets/post-password-change

**Auth0 Next.js SDK v4:**
- https://github.com/auth0/nextjs-auth0#readme
- https://auth0.com/docs/quickstart/webapp/nextjs

**Circle.so Admin API v2:**
- https://api.circle.so/apis/admin-api
- https://api-headless.circle.so/api/admin/v2/swagger.yaml

**Resend:**
- https://resend.com/docs/api-reference/emails/send-email
- https://react.email/docs/introduction

### 2. Web Search if Docs Are Insufficient
Search for: `$ARGUMENTS latest 2025 2026`

### 3. Verify Against Current Implementation
Compare findings with our existing stubs in `lib/` and `types/index.ts`.

## Output Format

Report:
- **Current API endpoint**: exact URL
- **Current auth method**: header format
- **Current request format**: example payload
- **Current response format**: example response
- **Breaking changes**: anything different from what we have in code
- **Recommended changes**: what needs to be updated before implementing
