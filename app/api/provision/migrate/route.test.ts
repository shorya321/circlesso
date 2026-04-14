/**
 * Integration tests for POST /api/provision/migrate
 */

// Mock Auth0 SDK (ESM)
jest.mock("@auth0/nextjs-auth0/server", () => ({
  Auth0Client: jest.fn().mockImplementation(() => ({
    middleware: jest.fn(),
    getSession: jest.fn(),
  })),
}));

import { POST } from "./route";
import { NextRequest } from "next/server";

const { auth0 } = require("@/lib/auth0");
const mockGetSession = auth0.getSession as jest.Mock;

jest.mock("@/lib/config", () => ({
  getConfig: () => ({
    PASSWORD_TICKET_RESULT_URL: "https://compass.helpucompli.com",
    PASSWORD_TICKET_TTL: 604800,
  }),
}));

const mockGetUserByEmail = jest.fn();
const mockCreateUser = jest.fn();
const mockCreatePasswordTicket = jest.fn();
const mockUpdateUserMetadata = jest.fn();
jest.mock("@/lib/auth0-management", () => ({
  getUserByEmail: (...args: unknown[]) => mockGetUserByEmail(...args),
  createUser: (...args: unknown[]) => mockCreateUser(...args),
  createPasswordTicket: (...args: unknown[]) =>
    mockCreatePasswordTicket(...args),
  updateUserMetadata: (...args: unknown[]) =>
    mockUpdateUserMetadata(...args),
}));

const mockSendWelcomeEmail = jest.fn();
jest.mock("@/lib/resend-email", () => ({
  sendWelcomeEmail: (...args: unknown[]) => mockSendWelcomeEmail(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3001/api/provision/migrate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/provision/migrate", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const response = await POST(
      makeRequest({ email: "a@test.com", name: "A", circleMemberId: "1" })
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 on invalid body", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { sub: "admin" } });
    const response = await POST(makeRequest({ email: "not-an-email" }));
    expect(response.status).toBe(400);
  });

  it("returns already provisioned when user exists", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { sub: "admin" } });
    mockGetUserByEmail.mockResolvedValueOnce({
      user_id: "auth0|existing",
      app_metadata: { email_sent: true },
    });

    const response = await POST(
      makeRequest({ email: "a@test.com", name: "A", circleMemberId: "1" })
    );
    const data = await response.json();

    expect(data.status).toBe("email_sent");
    expect(data.auth0UserId).toBe("auth0|existing");
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("provisions a new user end-to-end", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { sub: "admin" } });
    mockGetUserByEmail.mockResolvedValueOnce(null);
    mockCreateUser.mockResolvedValueOnce({ user_id: "auth0|new" });
    mockCreatePasswordTicket.mockResolvedValueOnce({
      ticket: "https://auth0.com/reset?ticket=abc",
    });
    mockSendWelcomeEmail.mockResolvedValueOnce({ id: "email-123" });
    mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

    const response = await POST(
      makeRequest({
        email: "new@test.com",
        name: "New User",
        circleMemberId: "42",
      })
    );
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.status).toBe("email_sent");
    expect(data.emailSent).toBe(true);
    expect(mockCreateUser).toHaveBeenCalledWith(
      "new@test.com",
      "New User",
      expect.objectContaining({ source: "admin_provisioning" })
    );
  });

  it("handles email failure gracefully (auth0_created status)", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { sub: "admin" } });
    mockGetUserByEmail.mockResolvedValueOnce(null);
    mockCreateUser.mockResolvedValueOnce({ user_id: "auth0|new" });
    mockCreatePasswordTicket.mockResolvedValueOnce({
      ticket: "https://auth0.com/reset?ticket=abc",
    });
    mockSendWelcomeEmail.mockRejectedValueOnce(new Error("Email failed"));
    mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

    const response = await POST(
      makeRequest({
        email: "new@test.com",
        name: "New User",
        circleMemberId: "42",
      })
    );
    const data = await response.json();

    expect(data.status).toBe("auth0_created");
    expect(data.emailSent).toBe(false);
    expect(data.error).toContain("welcome email failed");
  });
});
