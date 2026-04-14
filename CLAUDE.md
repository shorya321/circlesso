# CircleSo Admin — Auth0 User Provisioning Dashboard

## Project
Admin dashboard for migrating ~30 existing Circle.so members to Auth0 SSO and adding new members. Built on auth.helpucompli.com ecosystem.

**Circle.so community:** compass.helpucompli.com
**Auth0 tenant:** helpucompli.us.auth0.com
**Status:** Scaffolding complete, features pending implementation

## Tech Stack
- **Framework:** Next.js 16 (App Router, Route Handlers for API)
- **Language:** TypeScript (strict mode)
- **Database:** None (status tracked via Auth0 app_metadata)
- **Admin Auth:** Auth0 with @auth0/nextjs-auth0 v4 (org admin role)
- **Auth0 API:** Management API via M2M token (user provisioning)
- **Circle API:** Admin API v2 (member listing, creation, access groups)
- **Email:** Resend + React Email (branded welcome emails)
- **UI:** Tailwind CSS + shadcn/ui
- **Validation:** Zod (env vars, form inputs, API payloads)

## Architecture
```
Admin logs in via Auth0 (org admin role check)
  │
  ├── "Existing Members" tab
  │     Fetches Circle.so members via Admin API v2
  │     Shows Auth0 provisioning status per member
  │     "Migrate" button → creates Auth0 account + sends password email
  │
  └── "Add New Member" tab
        Form: name, email, access group
        Creates member in Circle.so + Auth0 + sends password email
```

### Provisioning Flow (per user)
1. Check Auth0 by email (skip if exists)
2. POST Auth0 /api/v2/users (random password, email_verified: false)
3. POST Auth0 /api/v2/tickets/password-change (mark_email_as_verified: true)
4. PATCH Auth0 /api/v2/users/{id} (set app_metadata.email_sent = true)
5. Send branded Resend email with password-set ticket link

## Directory Structure
```
circleso/
├── CLAUDE.md                         # This file — agent harness instructions
├── feature-list.json                 # Features with pass/fail tracking (JSON)
├── claude-progress.txt               # Cross-session progress log
├── init.sh                           # Session bootstrap script
├── middleware.ts                      # Auth0 v4 route protection
├── app/
│   ├── layout.tsx                    # Root layout with Auth0 UserProvider
│   ├── page.tsx                      # Redirect to /dashboard
│   ├── api/
│   │   ├── auth/[auth0]/route.ts     # Auth0 v4 auth handler
│   │   ├── circle/
│   │   │   ├── members/route.ts      # GET: list Circle members
│   │   │   └── access-groups/route.ts # GET: list access groups
│   │   ├── provision/
│   │   │   ├── migrate/route.ts      # POST: migrate existing member to Auth0
│   │   │   └── create/route.ts       # POST: create new member (Circle + Auth0)
│   │   └── status/route.ts           # GET: provisioning status for all members
│   └── dashboard/
│       ├── layout.tsx                # Dashboard layout (auth-protected)
│       ├── page.tsx                  # Existing Members tab
│       └── new-member/
│           └── page.tsx              # Add New Member form
├── components/
│   ├── member-table.tsx              # Table of Circle members with status
│   ├── new-member-form.tsx           # Form for adding new members
│   ├── provision-button.tsx          # Migrate/provision action button
│   └── status-badge.tsx              # Visual status indicator
├── lib/
│   ├── auth0-management.ts          # Auth0 M2M token + Management API calls
│   ├── circle-api.ts                # Circle.so Admin API v2 client
│   ├── resend-email.ts              # Resend client + email sending
│   ├── config.ts                    # Env validation (Zod, fail-fast)
│   └── utils.ts                     # Random password generator, helpers
├── emails/
│   └── welcome-email.tsx            # React Email template
├── types/
│   └── index.ts                     # TypeScript interfaces
├── .env.example
├── .env.local                       # (git-ignored)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

## Commands
- `npm run dev` — Next.js dev server (port 3001)
- `npm run build` — Production build
- `npm run start` — Production server
- `npm test` — Jest test suite
- `npm run lint` — ESLint

## Agent Harness Protocol

This project follows the Anthropic long-running agent harness pattern.

**On FIRST session:** Run `/init` — bootstraps project, creates feature list, writes init.sh
**On EVERY session:**
1. Run `pwd` to confirm working directory is `/Volumes/shorya/apps/circleso`
2. Read `claude-progress.txt` for recent work
3. Read `feature-list.json` (25 features, F001-F020 + F004B/F011B/F012B/F019B/F019C) and pick the highest-priority incomplete feature
4. Run `bash init.sh` to start dev server and verify basic functionality
5. Implement ONE feature at a time
6. Test the feature end-to-end
7. Mark it as passing in `feature-list.json` (only change `passes` field)
8. Git commit with descriptive message
9. Update `claude-progress.txt`

**NEVER** remove or edit feature descriptions in feature-list.json — only change `passes` field.
**NEVER** try to implement multiple features at once.
**ALWAYS** leave the codebase in a clean, working state.

## External API Reference

### Auth0 Management API (M2M)
- **M2M scopes:** `create:users`, `read:users`, `update:users`, `create:user_tickets`
- **Connection:** `Username-Password-Authentication`
- `GET /api/v2/users-by-email?email={email}` — check if user exists
- `POST /api/v2/users` — create user with random password
- `POST /api/v2/tickets/password-change` — generate password-set link (7-day TTL)
- `PATCH /api/v2/users/{id}` — update app_metadata (email_sent tracking)

### Circle.so Admin API v2
- **Base URL:** `https://app.circle.so/api/admin/v2`
- **Auth:** `Authorization: Bearer <CIRCLE_API_TOKEN>`
- `GET /community_members?per_page=100&community_id={id}` — list members
- `POST /community_members` — create member
- `GET /access_groups` — list access groups
- `POST /access_groups/{id}/members` — add member to access group

### Resend Email API
- **Package:** `resend` + `@react-email/components`
- Send welcome email with Auth0 password-change ticket URL

## Security Rules — CRITICAL
- NEVER hardcode secrets in source code
- ALL secrets from environment variables, validated at startup via Zod
- All API routes validate Auth0 session before processing
- Auth0 M2M client_secret stored in env variable only
- Circle API token stored in env variable only
- Resend API key stored in env variable only
- Random passwords generated with crypto.randomBytes (never stored or shown)
- Password-change ticket URLs are single-use
- No secrets in client-side code (all API calls from server-side route handlers)
- Bulk migration: sequential processing with 200ms delay between users (rate limit safety)

## References
- @docs/superpowers/specs/2026-04-14-admin-auth0-provisioning-design.md — Full design spec
