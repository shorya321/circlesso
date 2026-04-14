# Testing

## Test-Driven Development (TDD)

Mandatory workflow for every feature:
1. Write test first (RED) — test should fail
2. Write minimal implementation (GREEN) — test should pass
3. Refactor (IMPROVE) — clean up, keep tests passing

## Test Types

- **Unit tests**: lib/ functions (auth0-management, circle-api, resend-email, config)
- **Integration tests**: API route handlers (mock external APIs, test request/response)
- **E2E tests**: Full provisioning flow (manual verification for now)

## Framework

- Jest with ts-jest
- `@testing-library/react` for component tests
- Mock HTTP calls with `jest.fn()` or `jest.spyOn(global, 'fetch')`

## Coverage Target

80% on lib/ files. API route handlers should have at least happy-path + error-path tests.

## Test File Location

Co-locate tests: `lib/config.test.ts` next to `lib/config.ts`
