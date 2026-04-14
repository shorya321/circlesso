---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
---

> This file extends [common/testing.md](../common/testing.md) with TypeScript testing specifics.

# TypeScript Testing

## Jest Configuration

- `jest.config.ts` with `ts-jest` preset
- Module alias `@/` mapped to project root
- Node test environment for API/lib tests

## Mocking External APIs

```typescript
// Mock fetch for Auth0/Circle/Resend API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

// Example: mock Auth0 user creation
mockFetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({ user_id: "auth0|123", email: "test@example.com" }),
});
```

## Test Naming

```typescript
describe("createUser", () => {
  it("creates Auth0 user with random password and returns user_id", async () => {});
  it("returns null when user already exists (409)", async () => {});
  it("throws on Auth0 API error", async () => {});
});
```

## Run Tests

```bash
npm test                          # all tests
npm test -- --testPathPattern=config  # specific file
npm test -- --coverage            # with coverage
```
