# Security

## Mandatory Checks Before Every Commit

- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] All secrets from environment variables via `lib/config.ts`
- [ ] Auth0 session validated on all API routes
- [ ] All request bodies validated with Zod
- [ ] Error messages don't leak internal details
- [ ] No secrets logged (tokens, passwords, ticket URLs)
- [ ] Random passwords use `crypto.randomBytes`

## Auth0 Specifics

- M2M client_secret: env var only, never logged
- Password-change ticket URLs: single-use, don't log
- app_metadata: safe to read/write, never expose to client

## Circle.so Specifics

- API token: env var only, Bearer auth header
- Never log API token value

## Resend Specifics

- API key: env var only, starts with `re_`
- Never log API key value
