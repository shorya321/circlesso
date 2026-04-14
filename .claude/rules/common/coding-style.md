# Coding Style

## Immutability (CRITICAL)

ALWAYS create new objects, NEVER mutate existing ones. Use spread operators and functional patterns.

## File Organization

- 200-400 lines typical, 800 max
- One concern per file
- Organize by feature/domain: `lib/auth0-management.ts`, `lib/circle-api.ts`

## Error Handling

- Handle errors explicitly at every API call
- Provide user-friendly messages in UI
- Log detailed context server-side (never log secrets)
- Never silently swallow errors

## Input Validation

- Validate all user input with Zod before processing
- Validate all API request bodies in route handlers
- Fail fast with clear error messages

## Naming

- `camelCase` for variables and functions
- `PascalCase` for types, interfaces, components
- `UPPER_SNAKE_CASE` for constants
- Descriptive names: `createAuth0User` not `create`, `listCircleMembers` not `fetch`
