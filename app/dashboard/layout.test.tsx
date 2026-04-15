/**
 * Tests for dashboard layout — auth protection and shell rendering.
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

import { auth0 } from "@/lib/auth0";

const mockGetSession = auth0.getSession as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Dashboard layout", () => {
  it("redirects to /auth/login when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const { default: DashboardLayout } = await import("./layout");

    await expect(
      DashboardLayout({ children: null })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/auth/login");
  });

  it("renders layout with children when session exists", async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { name: "Admin User", email: "admin@test.com", sub: "auth0|123" },
    });

    const { default: DashboardLayout } = await import("./layout");
    const result = await DashboardLayout({
      children: "test-content",
    });

    expect(result).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
