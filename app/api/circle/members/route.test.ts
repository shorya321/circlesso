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

// Get the mocked auth0 instance
const { auth0 } = require("@/lib/auth0");
const mockGetSession = auth0.getSession as jest.Mock;

// Mock lib modules
jest.mock("@/lib/config", () => ({
  getConfig: () => ({ CIRCLE_COMMUNITY_ID: "12345" }),
}));

const mockListMembers = jest.fn();
jest.mock("@/lib/circle-api", () => ({
  listMembers: (...args: unknown[]) => mockListMembers(...args),
}));

const mockGetUserByEmail = jest.fn();
jest.mock("@/lib/auth0-management", () => ({
  getUserByEmail: (...args: unknown[]) => mockGetUserByEmail(...args),
}));

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
    mockGetSession.mockResolvedValueOnce(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns members with not_provisioned status when not in Auth0", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { sub: "admin" } });
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
    mockGetSession.mockResolvedValueOnce({ user: { sub: "admin" } });
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

  it("returns auth0_created status when user exists but email not sent", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { sub: "admin" } });
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
    mockGetSession.mockResolvedValueOnce({ user: { sub: "admin" } });
    mockListMembers.mockRejectedValueOnce(new Error("Circle API down"));

    const response = await GET();
    expect(response.status).toBe(500);
  });
});
