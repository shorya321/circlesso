/**
 * Tests for dashboard layout — auth protection (session + admin role) and shell rendering.
 */

jest.mock("@auth0/nextjs-auth0/server", () => ({
  Auth0Client: jest.fn().mockImplementation(() => ({
    middleware: jest.fn(),
    getSession: jest.fn(),
  })),
}));

const mockRedirect = jest.fn();
jest.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    throw new Error("NEXT_REDIRECT");
  },
}));

const mockCheckAdminAccess = jest.fn();
jest.mock("@/lib/admin-check", () => ({
  checkAdminAccess: (...args: unknown[]) => mockCheckAdminAccess(...args),
}));

import { auth0 } from "@/lib/auth0";

const mockGetSession = auth0.getSession as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Dashboard layout", () => {
  it("redirects to /auth/login when no session", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce({
      isAuthenticated: false,
      isAdmin: false,
      userId: null,
      email: null,
    });

    const { default: DashboardLayout } = await import("./layout");

    await expect(
      DashboardLayout({ children: null })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/auth/login");
  });

  it("redirects to /access-denied when authenticated but not admin", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce({
      isAuthenticated: true,
      isAdmin: false,
      userId: "auth0|user-1",
      email: "user@example.com",
    });

    const { default: DashboardLayout } = await import("./layout");

    await expect(
      DashboardLayout({ children: null })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/access-denied");
  });

  it("renders layout with children when authenticated admin", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce({
      isAuthenticated: true,
      isAdmin: true,
      userId: "auth0|admin-1",
      email: "admin@test.com",
    });
    mockGetSession.mockResolvedValueOnce({
      user: { name: "Admin User", email: "admin@test.com", sub: "auth0|admin-1" },
    });

    const { default: DashboardLayout } = await import("./layout");
    const result = await DashboardLayout({
      children: "test-content",
    });

    expect(result).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
