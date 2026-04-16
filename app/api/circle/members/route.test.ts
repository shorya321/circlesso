/**
 * Integration tests for GET /api/circle/members
 * Tests session validation, member fetching, and status derivation.
 */

// Mock Auth0 SDK (ESM)
jest.mock("@auth0/nextjs-auth0/server", () => ({
  Auth0Client: jest.fn().mockImplementation(() => ({
    middleware: jest.fn(),
    getSession: jest.fn(),
  })),
}));

import { GET } from "./route";
import type { MemberWithStatus } from "@/types";

const mockCheckAdminAccess = jest.fn();
jest.mock("@/lib/admin-check", () => ({
  checkAdminAccess: (...args: unknown[]) => mockCheckAdminAccess(...args),
}));

// Mock lib modules
jest.mock("@/lib/config", () => ({
  getConfig: () => ({ CIRCLE_COMMUNITY_ID: "12345" }),
}));

const ADMIN_ACCESS = {
  isAuthenticated: true,
  isAdmin: true,
  userId: "auth0|admin",
  email: "admin@example.com",
};
const NO_SESSION = {
  isAuthenticated: false,
  isAdmin: false,
  userId: null,
  email: null,
};
const NON_ADMIN_ACCESS = {
  isAuthenticated: true,
  isAdmin: false,
  userId: "auth0|user",
  email: "user@example.com",
};

const mockListMembers = jest.fn();
jest.mock("@/lib/circle-api", () => ({
  listMembers: (...args: unknown[]) => mockListMembers(...args),
}));

const mockGetUserByEmail = jest.fn();
jest.mock("@/lib/auth0-management", () => {
  class Auth0RateLimitError extends Error {
    readonly retryAfterMs: number;
    constructor(retryAfterMs: number, message: string) {
      super(message);
      this.name = "Auth0RateLimitError";
      this.retryAfterMs = retryAfterMs;
    }
  }
  return {
    Auth0RateLimitError,
    getUserByEmail: (...args: unknown[]) => mockGetUserByEmail(...args),
  };
});

// Re-import the mocked class so tests can construct it and route.ts's
// `instanceof Auth0RateLimitError` check resolves to the same constructor.
import { Auth0RateLimitError } from "@/lib/auth0-management";

beforeEach(() => {
  jest.clearAllMocks();
});

const makeMember = (id: number, email: string) => ({
  id,
  email,
  name: `User ${id}`,
  first_name: "User",
  last_name: `${id}`,
  avatar_url: null,
  headline: null,
  created_at: "2026-01-01T00:00:00.000Z",
  last_seen_at: null,
  active: true,
  public_uid: `uid-${id}`,
  user_id: id,
  community_id: 12345,
  member_tags: [],
  posts_count: 0,
  comments_count: 0,
});

describe("GET /api/circle/members", () => {
  it("returns 401 when not authenticated", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(NO_SESSION);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns 403 when authenticated but not admin", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(NON_ADMIN_ACCESS);
    const response = await GET();
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain("admin");
  });

  it("returns members with not_provisioned status when not in Auth0", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    mockListMembers.mockResolvedValueOnce([makeMember(1, "a@test.com")]);
    mockGetUserByEmail.mockResolvedValueOnce(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].auth0Status).toBe("not_provisioned");
    expect(data[0].auth0UserId).toBeNull();
  });

  it("returns email_sent status when Auth0 user has email_sent=true", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    mockListMembers.mockResolvedValueOnce([makeMember(1, "a@test.com")]);
    mockGetUserByEmail.mockResolvedValueOnce({
      user_id: "auth0|1",
      email: "a@test.com",
      app_metadata: { email_sent: true },
    });

    const response = await GET();
    const data = await response.json();

    expect(data[0].auth0Status).toBe("email_sent");
    expect(data[0].auth0UserId).toBe("auth0|1");
  });

  it("returns password_changed status when Auth0 user has email_sent=true and email_verified=true", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    mockListMembers.mockResolvedValueOnce([makeMember(1, "a@test.com")]);
    mockGetUserByEmail.mockResolvedValueOnce({
      user_id: "auth0|1",
      email: "a@test.com",
      email_verified: true,
      app_metadata: { email_sent: true },
    });

    const response = await GET();
    const data = await response.json();

    expect(data[0].auth0Status).toBe("password_changed");
    expect(data[0].auth0UserId).toBe("auth0|1");
  });

  it("returns auth0_created status when user exists but email not sent", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    mockListMembers.mockResolvedValueOnce([makeMember(1, "a@test.com")]);
    mockGetUserByEmail.mockResolvedValueOnce({
      user_id: "auth0|1",
      email: "a@test.com",
      app_metadata: {},
    });

    const response = await GET();
    const data = await response.json();

    expect(data[0].auth0Status).toBe("auth0_created");
  });

  it("returns 500 on Circle API error", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    mockListMembers.mockRejectedValueOnce(new Error("Circle API down"));

    const response = await GET();
    expect(response.status).toBe(500);
  });

  it("retries a failed Auth0 lookup once before marking member as failed", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    mockListMembers.mockResolvedValueOnce([makeMember(1, "a@test.com")]);
    mockGetUserByEmail
      .mockRejectedValueOnce(new Error("Auth0 rate limit"))
      .mockResolvedValueOnce({
        user_id: "auth0|1",
        email: "a@test.com",
        app_metadata: { email_sent: true },
      });

    const response = await GET();
    const data = await response.json();

    expect(mockGetUserByEmail).toHaveBeenCalledTimes(2);
    expect(data[0].auth0Status).toBe("email_sent");
    expect(data[0].auth0UserId).toBe("auth0|1");
  });

  it("succeeds on third attempt after two failures", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    mockListMembers.mockResolvedValueOnce([makeMember(1, "a@test.com")]);
    mockGetUserByEmail
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockResolvedValueOnce({
        user_id: "auth0|1",
        email: "a@test.com",
        app_metadata: { email_sent: true },
      });

    const response = await GET();
    const data = await response.json();

    expect(mockGetUserByEmail).toHaveBeenCalledTimes(3);
    expect(data[0].auth0Status).toBe("email_sent");
  });

  it("marks member as failed only after all five attempts throw", async () => {
    // Skip real backoff waits so the test fits under Jest's default timeout.
    // The retry logic calls setTimeout via the `sleep` helper; invoke the
    // callback synchronously to fast-forward through all backoffs.
    const setTimeoutSpy = jest
      .spyOn(global, "setTimeout")
      .mockImplementation(((cb: () => void) => {
        cb();
        return 0 as unknown as NodeJS.Timeout;
      }) as unknown as typeof setTimeout);

    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    mockListMembers.mockResolvedValueOnce([makeMember(1, "a@test.com")]);
    mockGetUserByEmail
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockRejectedValueOnce(new Error("rate limit"));

    const response = await GET();
    const data = await response.json();

    expect(mockGetUserByEmail).toHaveBeenCalledTimes(5);
    expect(data[0].auth0Status).toBe("failed");

    setTimeoutSpy.mockRestore();
  });

  it("honors Auth0RateLimitError retryAfterMs when retrying", async () => {
    // Capture the delays passed to setTimeout so we can assert the backoff
    // path for Auth0RateLimitError uses retryAfterMs, not exponential backoff.
    const delays: number[] = [];
    const setTimeoutSpy = jest
      .spyOn(global, "setTimeout")
      .mockImplementation(((cb: () => void, ms: number) => {
        delays.push(ms);
        cb();
        return 0 as unknown as NodeJS.Timeout;
      }) as unknown as typeof setTimeout);

    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    mockListMembers.mockResolvedValueOnce([makeMember(1, "a@test.com")]);
    mockGetUserByEmail
      .mockRejectedValueOnce(new Auth0RateLimitError(3000, "rate limited"))
      .mockResolvedValueOnce({
        user_id: "auth0|1",
        email: "a@test.com",
        app_metadata: { email_sent: true },
      });

    const response = await GET();
    const data = await response.json();

    expect(data[0].auth0Status).toBe("email_sent");
    // First (and only) backoff should respect retryAfterMs=3000 (+jitter up to 100).
    expect(delays).toHaveLength(1);
    expect(delays[0]).toBeGreaterThanOrEqual(3000);
    expect(delays[0]).toBeLessThan(3200);

    setTimeoutSpy.mockRestore();
  });

  it("processes all members even when one Auth0 lookup fails", async () => {
    // Member b@test.com exhausts all MAX_LOOKUP_ATTEMPTS; skip real backoff.
    const setTimeoutSpy = jest
      .spyOn(global, "setTimeout")
      .mockImplementation(((cb: () => void) => {
        cb();
        return 0 as unknown as NodeJS.Timeout;
      }) as unknown as typeof setTimeout);

    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    mockListMembers.mockResolvedValueOnce([
      makeMember(1, "a@test.com"),
      makeMember(2, "b@test.com"),
      makeMember(3, "c@test.com"),
    ]);
    mockGetUserByEmail.mockImplementation(async (email: string) => {
      if (email === "a@test.com") return null;
      if (email === "b@test.com") throw new Error("boom");
      if (email === "c@test.com") {
        return {
          user_id: "auth0|3",
          email: "c@test.com",
          app_metadata: { email_sent: true },
        };
      }
      throw new Error("unexpected email");
    });

    const response = await GET();
    const data = await response.json();

    expect(data).toHaveLength(3);
    expect(data[0].auth0Status).toBe("not_provisioned");
    expect(data[1].auth0Status).toBe("failed");
    expect(data[2].auth0Status).toBe("email_sent");

    setTimeoutSpy.mockRestore();
  });

  it("preserves member order when lookups run concurrently", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    const members = Array.from({ length: 12 }, (_, i) =>
      makeMember(i + 1, `u${i + 1}@test.com`)
    );
    mockListMembers.mockResolvedValueOnce(members);
    mockGetUserByEmail.mockImplementation(async (email: string) => {
      const n = Number(email.match(/u(\d+)/)?.[1] ?? 0);
      // stagger resolution so results arrive out of order
      await new Promise((r) => setTimeout(r, (12 - n) * 2));
      return {
        user_id: `auth0|${n}`,
        email,
        app_metadata: { email_sent: true },
      };
    });

    const response = await GET();
    const data = await response.json();

    expect(data).toHaveLength(12);
    data.forEach((row: MemberWithStatus, i: number) => {
      expect(row.circleMember.email).toBe(`u${i + 1}@test.com`);
      expect(row.auth0UserId).toBe(`auth0|${i + 1}`);
    });
  });
});
