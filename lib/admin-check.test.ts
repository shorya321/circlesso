/**
 * Tests for lib/admin-check.ts — admin role enforcement helper.
 */

// Mock Auth0 SDK before importing anything that uses it
jest.mock("@auth0/nextjs-auth0/server", () => ({
  Auth0Client: jest.fn().mockImplementation(() => ({
    middleware: jest.fn(),
    getSession: jest.fn(),
  })),
}));

import { checkAdminAccess, _resetAdminCache } from "./admin-check";
import { auth0 } from "./auth0";

const mockGetSession = auth0.getSession as jest.Mock;

jest.mock("./config", () => ({
  getConfig: () => ({
    ADMIN_ROLE_NAME: "superadmin",
  }),
}));

const mockGetUserRoles = jest.fn();
jest.mock("./auth0-management", () => ({
  getUserRoles: (...args: unknown[]) => mockGetUserRoles(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  _resetAdminCache();
});

describe("checkAdminAccess", () => {
  it("returns isAuthenticated=false when no session exists", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const result = await checkAdminAccess();

    expect(result.isAuthenticated).toBe(false);
    expect(result.isAdmin).toBe(false);
    expect(result.userId).toBeNull();
    expect(result.email).toBeNull();
    expect(mockGetUserRoles).not.toHaveBeenCalled();
  });

  it("returns isAdmin=true when user has the superadmin role", async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { sub: "auth0|admin-1", email: "admin@example.com" },
    });
    mockGetUserRoles.mockResolvedValueOnce([
      { id: "rol_1", name: "superadmin", description: "Superadmin role" },
    ]);

    const result = await checkAdminAccess();

    expect(result.isAuthenticated).toBe(true);
    expect(result.isAdmin).toBe(true);
    expect(result.userId).toBe("auth0|admin-1");
    expect(result.email).toBe("admin@example.com");
    expect(mockGetUserRoles).toHaveBeenCalledWith("auth0|admin-1");
  });

  it("returns isAdmin=false when user has roles but not the superadmin role", async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { sub: "auth0|user-1", email: "user@example.com" },
    });
    mockGetUserRoles.mockResolvedValueOnce([
      { id: "rol_2", name: "user" },
      { id: "rol_3", name: "viewer" },
    ]);

    const result = await checkAdminAccess();

    expect(result.isAuthenticated).toBe(true);
    expect(result.isAdmin).toBe(false);
    expect(result.userId).toBe("auth0|user-1");
  });

  it("returns isAdmin=false when user has no roles at all", async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { sub: "auth0|noroles", email: "noroles@example.com" },
    });
    mockGetUserRoles.mockResolvedValueOnce([]);

    const result = await checkAdminAccess();

    expect(result.isAuthenticated).toBe(true);
    expect(result.isAdmin).toBe(false);
  });

  it("caches admin result so repeated calls don't refetch roles", async () => {
    mockGetSession.mockResolvedValue({
      user: { sub: "auth0|cached", email: "cached@example.com" },
    });
    mockGetUserRoles.mockResolvedValueOnce([{ id: "rol_1", name: "superadmin" }]);

    const first = await checkAdminAccess();
    const second = await checkAdminAccess();
    const third = await checkAdminAccess();

    expect(first.isAdmin).toBe(true);
    expect(second.isAdmin).toBe(true);
    expect(third.isAdmin).toBe(true);
    // getUserRoles called only once due to cache
    expect(mockGetUserRoles).toHaveBeenCalledTimes(1);
  });

  it("fails closed (isAdmin=false) when getUserRoles throws", async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { sub: "auth0|err", email: "err@example.com" },
    });
    mockGetUserRoles.mockRejectedValueOnce(
      new Error("Auth0 getUserRoles failed: 403")
    );

    const result = await checkAdminAccess();

    expect(result.isAuthenticated).toBe(true);
    expect(result.isAdmin).toBe(false);
    expect(result.userId).toBe("auth0|err");
  });

  it("does NOT cache failures so subsequent calls retry the API", async () => {
    mockGetSession.mockResolvedValue({
      user: { sub: "auth0|retry", email: "retry@example.com" },
    });
    mockGetUserRoles.mockRejectedValueOnce(new Error("Transient error"));
    mockGetUserRoles.mockResolvedValueOnce([{ id: "rol_1", name: "superadmin" }]);

    const first = await checkAdminAccess();
    const second = await checkAdminAccess();

    expect(first.isAdmin).toBe(false);
    expect(second.isAdmin).toBe(true);
    expect(mockGetUserRoles).toHaveBeenCalledTimes(2);
  });

  it("handles session with no email gracefully", async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { sub: "auth0|no-email" },
    });
    mockGetUserRoles.mockResolvedValueOnce([{ id: "rol_1", name: "superadmin" }]);

    const result = await checkAdminAccess();

    expect(result.isAuthenticated).toBe(true);
    expect(result.isAdmin).toBe(true);
    expect(result.email).toBeNull();
  });
});
