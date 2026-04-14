# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Admin dashboard for migrating ~30 existing Circle.so members (compass.helpucompli.com) to Auth0 SSO (helpucompli.us.auth0.com) and onboarding new members. No database — provisioning status tracked via Auth0 `app_metadata`.

## Commands

```bash
npm run dev              # Dev server on port 3001 (Turbopack)
npm run build            # Production build
npm test                 # Jest test suite
npm test -- --testPathPattern=config  # Run single test file
npm run test:coverage    # Jest with coverage report
npm run lint             # ESLint
npx tsc --noEmit         # Type check without emitting
```

## Architecture

Two auth systems, one dashboard:

- **Admin login**: `@auth0/nextjs-auth0` v4 — Regular Web Application, org admin role check via `middleware.ts`
- **User provisioning**: Auth0 Management API via separate M2M application (`lib/auth0-management.ts`)
- **Member data**: Circle.so Admin API v2 at `https://app.circle.so/api/admin/v2` with `Bearer` token (`lib/circle-api.ts`)
- **Email**: Resend API with React Email template (`emails/welcome-email.tsx` + `lib/resend-email.ts`)

### Data flow (no database)

Status is derived at read time by querying Auth0 for each Circle member:
- Not in Auth0 → `not_provisioned` (red)
- In Auth0, `app_metadata.email_sent !== true` → `auth0_created` (yellow)
- In Auth0, `app_metadata.email_sent === true` → `email_sent` (green)

### Provisioning flow (per user)

1. `GET /api/v2/users-by-email` — skip if exists
2. `POST /api/v2/users` — random password via `crypto.randomBytes`, sets `app_metadata.source`
3. `POST /api/v2/tickets/password-change` — 7-day TTL, `mark_email_as_verified: true`
4. `PATCH /api/v2/users/{id}` — sets `app_metadata.email_sent = true`
5. Resend API — branded welcome email with ticket link

### Key patterns

- All API routes are server-side Route Handlers under `app/api/`
- Every route validates Auth0 session before processing
- Env vars validated at startup via Zod schema in `lib/config.ts` — app fails fast on missing vars
- Types centralized in `types/index.ts`
- Bulk migration: sequential with 200ms delay between users (Auth0 rate limit: 50 req/sec)
- Circle.so API uses pagination (`per_page=100`, check `has_next_page`)

## External APIs

| API | Base URL | Auth | M2M Scopes |
|-----|----------|------|------------|
| Auth0 Management | `https://{AUTH0_DOMAIN}/api/v2` | `Bearer <M2M token>` | `create:users`, `read:users`, `update:users`, `create:user_tickets` |
| Circle.so Admin v2 | `https://app.circle.so/api/admin/v2` | `Bearer <CIRCLE_API_TOKEN>` | — |
| Resend | `https://api.resend.com` | `Bearer <RESEND_API_KEY>` | — |

## Auth0 API Payloads

**Create user:**
```json
{
  "email": "user@example.com",
  "connection": "Username-Password-Authentication",
  "password": "<random-32-char-via-crypto.randomBytes>",
  "email_verified": false,
  "name": "First Last",
  "app_metadata": { "source": "admin_provisioning", "circle_member_id": "123" }
}
```

**Password change ticket:**
```json
{
  "user_id": "auth0|...",
  "result_url": "https://compass.helpucompli.com",
  "mark_email_as_verified": true,
  "ttl_sec": 604800
}
```
Returns: `{ "ticket": "https://tenant.auth0.com/lo/reset?ticket=..." }`

**M2M token caching:** Fetch via `POST /oauth/token` with `grant_type=client_credentials`. Cache based on actual `expires_in` value from response minus 5-minute safety margin. Do NOT hardcode 24 hours.

## Error Handling

| Error | Handling |
|-------|----------|
| Auth0 user already exists (409) | Return `already_provisioned`, show blue badge |
| Circle member creation fails | Stop, show error, don't create Auth0 account |
| Auth0 creation succeeds but email fails | Set `app_metadata.email_sent = false`, show "Retry Email" button (yellow badge) |
| Auth0 M2M token expired | Auto-refresh from cache expiry check |
| Circle API rate limit (429) | Show error toast, admin retries manually |
| Invalid email format | Reject at Zod form validation before any API call |

## Partial Failure Recovery (Add New Member flow)

5 sequential API calls — each can fail independently:

| Step | If Fails | Recovery |
|------|----------|----------|
| 1. Circle member creation | Stop, show error | No cleanup needed |
| 2. Access group assignment | Show warning "Member created but not in access group" | Admin retries via Circle dashboard |
| 3. Auth0 user creation | Show error "Created in Circle but Auth0 failed" | Admin retries from Existing Members tab (member now visible from Circle API) |
| 4. Password ticket generation | Show error | Admin retries migration (Auth0 user exists, will get `already_provisioned` → skip to ticket) |
| 5. Resend email | Set `app_metadata.email_sent = false`, show "Retry Email" button | Admin clicks retry |

## Agent Harness Protocol

This project uses the Anthropic long-running agent harness pattern.

**Every session:**
1. Read `claude-progress.txt` for prior work
2. Read `feature-list.json` — pick highest-priority feature where `passes: false`
3. Run `bash init.sh` to start dev server
4. Implement ONE feature at a time using TDD (test first → implement → verify)
5. Before implementing any external API call, verify current docs via `ref_read_url` or `ref_search_documentation`
6. Mark `passes: true` in `feature-list.json` — ONLY change the `passes` field
7. Commit: `feat: implement F0XX — <description>`
8. Append summary to `claude-progress.txt`

**25 features** (F001–F020 + F004B/F011B/F012B/F019B/F019C) across setup → functional → api → ui → integration → security.

## References

- `design-system/DESIGN.md` — **MUST follow** for all UI work (colors, typography, badges, spacing, components)
- `docs/superpowers/specs/2026-04-14-admin-auth0-provisioning-design.md` — full design spec
- `.claude/commands/` — agent commands: `/init`, `/implement`, `/verify`, `/progress`, `/research`, `/review`, `/build-fix`
- `.claude/agents/` — planner, code-reviewer, build-error-resolver, security-reviewer
- `.claude/rules/` — coding standards, testing, security, research-first workflow
