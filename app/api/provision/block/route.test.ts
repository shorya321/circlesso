/**
 * Integration tests for POST /api/provision/block
 */

jest.mock("@auth0/nextjs-auth0/server", () => ({
  Auth0Client: jest.fn().mockImplementation(() => ({
    middleware: jest.fn(),
    getSession: jest.fn(),
  })),
}));

import { POST } from "./route";
import { NextRequest } from "next/server";

const mockCheckAdminAccess = jest.fn();
jest.mock("@/lib/admin-check", () => ({
  checkAdminAccess: (...args: unknown[]) => mockCheckAdminAccess(...args),
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

const mockBlockUser = jest.fn();
jest.mock("@/lib/auth0-management", () => ({
  blockUser: (...args: unknown[]) => mockBlockUser(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3001/api/provision/block", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_BODY = { auth0UserId: "auth0|abc123" };

describe("POST /api/provision/block", () => {
  it("returns 401 when not authenticated", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(NO_SESSION);
    const response = await POST(makeRequest(VALID_BODY));
    expect(response.status).toBe(401);
  });

  it("returns 403 when authenticated but not admin", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(NON_ADMIN_ACCESS);
    const response = await POST(makeRequest(VALID_BODY));
    expect(response.status).toBe(403);
  });

  it("returns 400 when auth0UserId is missing", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
  });

  it("returns 400 when auth0UserId is empty", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    const response = await POST(makeRequest({ auth0UserId: "" }));
    expect(response.status).toBe(400);
  });

  it("blocks the user and returns success", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    mockBlockUser.mockResolvedValueOnce(undefined);

    const response = await POST(makeRequest(VALID_BODY));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe("blocked");
    expect(data.auth0UserId).toBe("auth0|abc123");
    expect(mockBlockUser).toHaveBeenCalledWith("auth0|abc123");
  });

  it("returns 500 when blockUser throws", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    mockBlockUser.mockRejectedValueOnce(new Error("Auth0 blockUser failed: 404"));

    const response = await POST(makeRequest(VALID_BODY));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain("blockUser");
  });
});
