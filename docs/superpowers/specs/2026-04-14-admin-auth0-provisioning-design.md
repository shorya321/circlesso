# Admin Auth0 User Provisioning Dashboard

**Date:** 2026-04-14
**Status:** Draft
**Project:** `/Volumes/shorya/apps/circleso`

## Problem

HelpUcompli uses Circle.so (compass.helpucompli.com) with ~30 existing members. The platform is migrating to Auth0 SSO for authentication. Auth0 is currently empty. Existing Circle.so members need Auth0 accounts so they can log in via SSO, and new members need to be created in both Auth0 and Circle.so. Since passwords cannot be migrated from Circle.so, every user must receive a "set your password" email.

## Solution

A Next.js 16 admin dashboard that enables an admin to:
1. **Migrate existing Circle.so members** to Auth0 (create Auth0 account + send password email)
2. **Add new members** to both Circle.so (with access group) and Auth0 (with password email)

No database — with only ~30 members, the system queries Auth0 and Circle.so APIs directly.

## Architecture

```
Admin (Auth0 org admin login)
  │
  ├── "Existing Members" tab
  │     │
  │     ├── GET Circle.so Admin API v2 /community_members
  │     │     → shows table of all Circle members
  │     │
  │     ├── GET Auth0 /api/v2/users-by-email?email=...
  │     │     → marks who already has Auth0 account
  │     │
  │     └── "Migrate" button per member (or select all)
  │           1. POST Auth0 /api/v2/users (random password)
  │           2. POST Auth0 /api/v2/tickets/password-change
  │           3. POST Resend API (welcome email with ticket link)
  │
  ├── "Add New Member" tab
  │     │
  │     ├── Form: first_name, last_name, email
  │     ├── Dropdown: access group (from Circle API v2 /access_groups)
  │     │
  │     └── "Create" button
  │           1. POST Circle.so Admin API v2 /community_members
  │           2. POST Circle.so Admin API v2 /access_groups/{id}/members
  │           3. POST Auth0 /api/v2/users (random password)
  │           4. POST Auth0 /api/v2/tickets/password-change
  │           5. POST Resend API (welcome email with ticket link)
  │
  └── "Migration Status" section
        → For each Circle member, show:
           - Name, email
           - Circle.so status (existing access groups)
           - Auth0 status (provisioned / not yet)
           - Email status (sent / not sent)
```

## Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Framework | Next.js 16 (App Router) | Matches helpucompli-sso project |
| Language | TypeScript (strict) | Type safety |
| Database | None | Only ~30 members, query APIs directly |
| Admin auth | Auth0 (org admin role) | Consistent with SSO setup |
| Auth0 API | Management API (M2M token) | Server-side user creation |
| Circle API | Admin API v2 | List members, create members, manage access groups |
| Email | Resend + React Email | Modern, developer-friendly, branded templates |
| UI | Tailwind CSS + shadcn/ui | Rapid, polished admin UI |

## External API Details

### Auth0 Management API

**M2M Token Setup:**
- Create Machine-to-Machine app in Auth0 Dashboard
- Authorize for Auth0 Management API
- Required scopes: `create:users`, `read:users`, `create:user_tickets`

**Endpoints used:**

| Action | Method | Endpoint |
|--------|--------|----------|
| Check if user exists | GET | `/api/v2/users-by-email?email={email}` |
| Create user | POST | `/api/v2/users` |
| Generate password ticket | POST | `/api/v2/tickets/password-change` |

**Create user payload:**
```json
{
  "email": "user@example.com",
  "connection": "Username-Password-Authentication",
  "password": "<random-32-char>",
  "email_verified": false,
  "name": "First Last",
  "app_metadata": { "source": "admin_provisioning", "circle_member_id": "123" }
}
```

**Password change ticket payload:**
```json
{
  "user_id": "auth0|...",
  "result_url": "https://compass.helpucompli.com",
  "mark_email_as_verified": true,
  "ttl_sec": 604800
}
```
Returns: `{ "ticket": "https://tenant.auth0.com/lo/reset?ticket=..." }`

**M2M Token caching:** Cache based on the actual `expires_in` value from the token response minus a 5-minute safety margin. Implemented as a module-level variable with expiry check.

### Circle.so Admin API v2

**Auth:** `Authorization: Bearer <CIRCLE_API_TOKEN>` (from Circle Dashboard > Developers > Tokens)
**Base URL:** `https://app.circle.so/api/admin/v2`

**Endpoints used:**

| Action | Method | Endpoint |
|--------|--------|----------|
| List members | GET | `/community_members?per_page=100&community_id={id}` |
| Create member | POST | `/community_members` |
| List access groups | GET | `/access_groups` |
| Add member to group | POST | `/access_groups/{id}/members` |

### Resend Email API

**Setup:** API key from resend.com dashboard
**Package:** `resend` npm package + `@react-email/components` for templates

**Email template:** "Welcome to HelpUcompli"
- Subject: "Set up your HelpUcompli account"
- Body: branded welcome message + "Set Your Password" button (links to Auth0 ticket URL)
- From: `noreply@helpucompli.com` (requires domain verification in Resend)

## Environment Variables

```env
# Auth0 Management API (M2M)
AUTH0_DOMAIN=helpucompli.us.auth0.com
AUTH0_M2M_CLIENT_ID=your-m2m-client-id
AUTH0_M2M_CLIENT_SECRET=your-m2m-client-secret
AUTH0_DB_CONNECTION=Username-Password-Authentication

# Auth0 Admin Login (for dashboard access — @auth0/nextjs-auth0 v4)
AUTH0_CLIENT_ID=your-web-app-client-id
AUTH0_CLIENT_SECRET=your-web-app-client-secret
AUTH0_DOMAIN=helpucompli.us.auth0.com
APP_BASE_URL=http://localhost:3000
AUTH0_SECRET=random-secret-for-session

# Circle.so Admin API
CIRCLE_API_TOKEN=your-circle-admin-api-token
CIRCLE_COMMUNITY_ID=your-community-id

# Resend
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=noreply@helpucompli.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
PASSWORD_TICKET_TTL=604800
PASSWORD_TICKET_RESULT_URL=https://compass.helpucompli.com
```

## Directory Structure

```
circleso/
├── middleware.ts                     # Auth0 v4 middleware (protects /dashboard/*)
├── app/
│   ├── layout.tsx                    # Root layout with Auth0 provider
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
│       ├── page.tsx                  # Main dashboard (existing members tab)
│       └── new-member/
│           └── page.tsx              # Add new member form
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

## Component Behavior

### Existing Members Tab (Dashboard)

1. On load: `GET /api/circle/members` → returns all Circle.so community members
2. For each member: `GET /api/status?email={email}` → checks if Auth0 account exists
3. Table columns: Name | Email | Circle Access Groups | Auth0 Status | Action
4. Auth0 Status shows: "Not Provisioned" (red) | "Provisioned" (green) | "Email Sent" (blue)
5. "Migrate" button per row, or "Migrate All Unprovisioned" bulk button
6. On click: `POST /api/provision/migrate` with `{ email, name, circleMemberId }`
7. Shows loading spinner per row during provisioning
8. Updates status badge on completion

### Add New Member Tab

1. Form fields: First Name, Last Name, Email, Access Group (dropdown)
2. Access group dropdown fetched from `GET /api/circle/access-groups`
3. On submit: `POST /api/provision/create` with all fields
4. Shows success/error toast notification
5. Validates email format client-side, checks duplicate server-side

### Welcome Email Template

```
Subject: Set up your HelpUcompli account

Hi {name},

Your HelpUcompli account is ready! Click the button below to set your password
and get started.

[Set Your Password]  ← links to Auth0 password-change ticket URL

This link expires in 7 days. If it expires, contact your administrator.

— The HelpUcompli Team
```

## Email Status Tracking (No Database)

Since there is no database, email/provisioning status is tracked via Auth0 `app_metadata`:
- When a user is created in Auth0, `app_metadata.source = "admin_provisioning"` is set
- When the password email is sent, `app_metadata.email_sent = true` and `app_metadata.email_sent_at = <ISO timestamp>` are set via `PATCH /api/v2/users/{id}` (requires `update:users` scope)
- The dashboard reconstructs status by reading `app_metadata` from Auth0 user profiles
- This survives page refreshes and new sessions

**Status derivation:**
- User not in Auth0 → "Not Provisioned" (red)
- User in Auth0 + `app_metadata.email_sent !== true` → "Auth0 Created, Email Pending" (yellow)
- User in Auth0 + `app_metadata.email_sent === true` → "Provisioned + Email Sent" (green)

**Updated M2M scopes:** `create:users`, `read:users`, `update:users`, `create:user_tickets`

## Bulk Migration Rate Limiting

For "Migrate All" operations, process users sequentially with a 200ms delay between each user to stay well within Auth0 rate limits (50 req/sec production). Each migration = 3 API calls (create + ticket + email), so 30 users = ~90 calls over ~6 seconds. The UI shows a progress indicator ("Migrating 5/30...") and disables the button during processing.

## Partial Failure Recovery

**"Add New Member" flow (5 sequential steps):**
- If Circle member creation fails → stop, show error, no cleanup needed
- If access group assignment fails → show warning "Member created but not in access group", admin can retry via Circle dashboard
- If Auth0 creation fails after Circle success → show error "Created in Circle but Auth0 failed", admin can retry migration from Existing Members tab
- If email send fails after Auth0 success → update `app_metadata.email_sent = false`, show "Retry Email" button

## Error Handling

| Error | Handling |
|-------|----------|
| Auth0 user already exists (409) | Show "Already provisioned" status, skip |
| Circle member creation fails | Return error, don't create Auth0 account |
| Auth0 creation succeeds but email fails | Show "Auth0 Created, Email Failed" status with retry button |
| Auth0 M2M token expired | Auto-refresh (cached with expiry check) |
| Circle API rate limit | Show error, admin retries manually |
| Invalid email | Reject at form validation |

## Security

- Admin dashboard protected by Auth0 login with org admin role check
- Auth0 M2M client_secret stored in env variable only
- Circle API token stored in env variable only
- Resend API key stored in env variable only
- All API routes validate Auth0 session before processing
- Password-change ticket URLs are single-use
- Random passwords generated with crypto.randomBytes (never stored or shown)
- No secrets in client-side code (all API calls from server-side route handlers)

## Verification Plan

1. **Auth0 M2M token:** Run `GET /api/v2/users` with token — should return empty list
2. **Circle API:** Run `GET /community_members` — should return ~30 members
3. **Migrate one existing member:** Create Auth0 account + send email → check Auth0 Dashboard + email inbox
4. **Add one new member:** Create in Circle + Auth0 + send email → check both dashboards + inbox
5. **Duplicate check:** Try migrating same member twice → should show "Already provisioned"
6. **Email template:** Verify password-set link works and redirects to compass.helpucompli.com after password set
7. **Auth protection:** Access dashboard without login → should redirect to Auth0 login
8. **Partial failure (new member):** Create in Circle, then simulate Auth0 failure → verify Circle member exists and can be retried from Existing Members tab
9. **Email retry:** Provision a user but simulate Resend failure → verify "Retry Email" button appears and works
10. **Bulk migration:** Click "Migrate All" → verify sequential processing with progress indicator and no rate limit errors
