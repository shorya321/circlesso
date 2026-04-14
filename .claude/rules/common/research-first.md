# Research Before Implementing (CRITICAL)

## Rule

Before implementing ANY feature that touches an external API or library, you MUST verify the current API/SDK behavior using live documentation. Never rely solely on training data.

## When This Applies

- Auth0 Management API or @auth0/nextjs-auth0 SDK
- Circle.so Admin API v2
- Resend email API or @react-email/components
- Any npm package being used for the first time
- Any API endpoint, request format, or response format

## Research Priority

1. **Context7 MCP** — use `ref_search_documentation` or the `/docs` skill to fetch current library docs
2. **Ref MCP** — use `ref_read_url` to read specific documentation URLs:
   - Auth0: https://auth0.com/docs/api/management/v2
   - Circle.so: https://api.circle.so/apis/admin-api
   - Resend: https://resend.com/docs/api-reference
   - @auth0/nextjs-auth0: https://github.com/auth0/nextjs-auth0
3. **Web Search** — search for latest patterns if docs are insufficient

## Verification Checklist

Before writing implementation code, confirm:
- [ ] API endpoint URL is correct (not from training data)
- [ ] Request payload format matches current docs
- [ ] Response format matches current docs
- [ ] Auth header format is correct (Bearer vs Token, etc.)
- [ ] SDK import paths and function signatures are current
- [ ] No deprecated methods or patterns used

## Example

WRONG: Assume `@auth0/nextjs-auth0` exports `auth0` for middleware
RIGHT: Check current docs → discover v4 uses `Auth0Client` + `middleware()` method

WRONG: Assume Circle.so base URL is `api-headless.circle.so`
RIGHT: Check current docs → discover it's `app.circle.so/api/admin/v2`
