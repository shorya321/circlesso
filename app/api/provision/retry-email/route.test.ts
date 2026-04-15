/**
 * Integration tests for POST /api/provision/retry-email
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

jest.mock("@/lib/config", () => ({
  getConfig: () => ({
    PASSWORD_TICKET_RESULT_URL: "https://compass.helpucompli.com",
    PASSWORD_TICKET_TTL: 604800,
  }),
}));

const mockCreatePasswordTicket = jest.fn();
const mockUpdateUserMetadata = jest.fn();
jest.mock("@/lib/auth0-management", () => ({
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
  return new NextRequest(
    "http://localhost:3001/api/provision/retry-email",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

const VALID_BODY = {
  email: "user@test.com",
  name: "Test User",
  auth0UserId: "auth0|abc123",
};

describe("POST /api/provision/retry-email", () => {
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

  it("returns 400 on invalid body (bad email)", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    const response = await POST(
      makeRequest({ ...VALID_BODY, email: "not-an-email" })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when auth0UserId is missing", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    const response = await POST(
      makeRequest({ email: "u@test.com", name: "U" })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when auth0UserId is empty string", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    const response = await POST(
      makeRequest({ ...VALID_BODY, auth0UserId: "" })
    );
    expect(response.status).toBe(400);
  });

  it("resends welcome email and marks email_sent=true on success", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    mockCreatePasswordTicket.mockResolvedValueOnce({
      ticket: "https://auth0.com/lo/reset?ticket=fresh",
    });
    mockSendWelcomeEmail.mockResolvedValueOnce({ id: "email-xyz" });
    mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

    const response = await POST(makeRequest(VALID_BODY));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe("email_sent");
    expect(data.auth0UserId).toBe("auth0|abc123");
    expect(data.emailSent).toBe(true);

    expect(mockCreatePasswordTicket).toHaveBeenCalledWith(
      "auth0|abc123",
      "https://compass.helpucompli.com",
      604800
    );
    expect(mockSendWelcomeEmail).toHaveBeenCalledWith(
      "user@test.com",
      "Test User",
      "https://auth0.com/lo/reset?ticket=fresh"
    );
    expect(mockUpdateUserMetadata).toHaveBeenCalledWith(
      "auth0|abc123",
      expect.objectContaining({
        email_sent: true,
        email_sent_at: expect.any(String),
      })
    );
  });

  it("returns 500 with email_sent=false when sendWelcomeEmail fails", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    mockCreatePasswordTicket.mockResolvedValueOnce({
      ticket: "https://auth0.com/lo/reset?ticket=fresh",
    });
    mockSendWelcomeEmail.mockRejectedValueOnce(new Error("Resend is down"));
    mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

    const response = await POST(makeRequest(VALID_BODY));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.status).toBe("auth0_created");
    expect(data.emailSent).toBe(false);
    expect(data.error).toContain("Resend is down");

    // Metadata rolled back to email_sent=false so the dashboard badge reflects reality.
    expect(mockUpdateUserMetadata).toHaveBeenCalledWith(
      "auth0|abc123",
      { email_sent: false }
    );
  });

  it("still returns 500 when metadata rollback also fails (best-effort)", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    mockCreatePasswordTicket.mockResolvedValueOnce({
      ticket: "https://auth0.com/lo/reset?ticket=fresh",
    });
    mockSendWelcomeEmail.mockRejectedValueOnce(new Error("Resend is down"));
    mockUpdateUserMetadata.mockRejectedValueOnce(new Error("Auth0 down"));

    const response = await POST(makeRequest(VALID_BODY));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("Resend is down");
  });

  it("returns 500 when createPasswordTicket fails", async () => {
    mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
    mockCreatePasswordTicket.mockRejectedValueOnce(
      new Error("Auth0 createPasswordTicket failed: 404")
    );

    const response = await POST(makeRequest(VALID_BODY));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain("createPasswordTicket");
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });
});
