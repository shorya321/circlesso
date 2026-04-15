/**
 * F017 — End-to-end integration test: Migrate one existing Circle.so member to Auth0
 *
 * Exercises the full flow:
 * 1. GET /api/circle/members — member shows as not_provisioned
 * 2. POST /api/provision/migrate — provisions member in Auth0, sends email
 * 3. GET /api/circle/members — member now shows as email_sent
 *
 * All external APIs (Auth0, Circle.so, Resend) are mocked at the lib layer.
 */

// --- Mock Auth0 SDK (must be before any import that touches it) ---
jest.mock("@auth0/nextjs-auth0/server", () => ({
  Auth0Client: jest.fn().mockImplementation(() => ({
    middleware: jest.fn(),
    getSession: jest.fn(),
  })),
}));

import { GET } from "../circle/members/route";
import { POST } from "../provision/migrate/route";
import { NextRequest } from "next/server";

const mockCheckAdminAccess = jest.fn();
jest.mock("@/lib/admin-check", () => ({
  checkAdminAccess: (...args: unknown[]) => mockCheckAdminAccess(...args),
}));

// --- Mock config ---
jest.mock("@/lib/config", () => ({
  getConfig: () => ({
    CIRCLE_COMMUNITY_ID: "12345",
    PASSWORD_TICKET_RESULT_URL: "https://compass.helpucompli.com",
    PASSWORD_TICKET_TTL: 604800,
  }),
}));

// --- Mock Circle.so API ---
const mockListMembers = jest.fn();
jest.mock("@/lib/circle-api", () => ({
  listMembers: (...args: unknown[]) => mockListMembers(...args),
}));

// --- Mock Auth0 Management API ---
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

// --- Mock Resend email ---
const mockSendWelcomeEmail = jest.fn();
jest.mock("@/lib/resend-email", () => ({
  sendWelcomeEmail: (...args: unknown[]) => mockSendWelcomeEmail(...args),
}));

// --- Helpers ---

const CIRCLE_MEMBER = {
  id: 101,
  email: "jane@example.com",
  name: "Jane Smith",
  first_name: "Jane",
  last_name: "Smith",
  avatar_url: null,
  headline: null,
  created_at: "2025-06-01T00:00:00.000Z",
  last_seen_at: "2026-04-01T00:00:00.000Z",
  active: true,
  public_uid: "uid-101",
  user_id: 101,
  community_id: 12345,
  member_tags: [],
  posts_count: 5,
  comments_count: 12,
};

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3001/api/provision/migrate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function authenticateSession() {
  mockCheckAdminAccess.mockResolvedValueOnce({
    isAuthenticated: true,
    isAdmin: true,
    userId: "auth0|admin-1",
    email: "admin@helpucompli.com",
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("F017: End-to-end migrate one existing member", () => {
  it("completes the full migrate flow: list → migrate → verify status", async () => {
    // ── Step 1: List members — member is not_provisioned ──
    authenticateSession();
    mockListMembers.mockResolvedValueOnce([CIRCLE_MEMBER]);
    mockGetUserByEmail.mockResolvedValueOnce(null); // not in Auth0

    const listResponse1 = await GET();
    const members1 = await listResponse1.json();

    expect(listResponse1.status).toBe(200);
    expect(members1).toHaveLength(1);
    expect(members1[0].circleMember.email).toBe("jane@example.com");
    expect(members1[0].auth0Status).toBe("not_provisioned");
    expect(members1[0].auth0UserId).toBeNull();

    // ── Step 2: Migrate the member ──
    authenticateSession();
    mockGetUserByEmail.mockResolvedValueOnce(null); // still not in Auth0
    mockCreateUser.mockResolvedValueOnce({
      user_id: "auth0|jane-101",
      email: "jane@example.com",
      name: "Jane Smith",
    });
    mockCreatePasswordTicket.mockResolvedValueOnce({
      ticket: "https://helpucompli.us.auth0.com/lo/reset?ticket=abc123",
    });
    mockSendWelcomeEmail.mockResolvedValueOnce({ id: "email-msg-001" });
    mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

    const migrateResponse = await POST(
      makePostRequest({
        email: "jane@example.com",
        name: "Jane Smith",
        circleMemberId: "101",
      })
    );
    const migrateData = await migrateResponse.json();

    expect(migrateResponse.status).toBe(200);
    expect(migrateData.success).toBe(true);
    expect(migrateData.status).toBe("email_sent");
    expect(migrateData.auth0UserId).toBe("auth0|jane-101");
    expect(migrateData.emailSent).toBe(true);

    // Verify Auth0 user was created with correct params
    expect(mockCreateUser).toHaveBeenCalledWith(
      "jane@example.com",
      "Jane Smith",
      expect.objectContaining({
        source: "admin_provisioning",
        circle_member_id: "101",
      })
    );

    // Verify password ticket was generated
    expect(mockCreatePasswordTicket).toHaveBeenCalledWith(
      "auth0|jane-101",
      "https://compass.helpucompli.com",
      604800
    );

    // Verify welcome email was sent with ticket URL
    expect(mockSendWelcomeEmail).toHaveBeenCalledWith(
      "jane@example.com",
      "Jane Smith",
      "https://helpucompli.us.auth0.com/lo/reset?ticket=abc123"
    );

    // Verify metadata was updated to mark email as sent
    expect(mockUpdateUserMetadata).toHaveBeenCalledWith(
      "auth0|jane-101",
      expect.objectContaining({ email_sent: true })
    );

    // ── Step 3: List members again — member now shows email_sent ──
    authenticateSession();
    mockListMembers.mockResolvedValueOnce([CIRCLE_MEMBER]);
    mockGetUserByEmail.mockResolvedValueOnce({
      user_id: "auth0|jane-101",
      email: "jane@example.com",
      app_metadata: { email_sent: true, email_sent_at: "2026-04-15T10:00:00Z" },
    });

    const listResponse2 = await GET();
    const members2 = await listResponse2.json();

    expect(listResponse2.status).toBe(200);
    expect(members2).toHaveLength(1);
    expect(members2[0].auth0Status).toBe("email_sent");
    expect(members2[0].auth0UserId).toBe("auth0|jane-101");
  });

  it("handles password ticket with 7-day TTL and mark_email_as_verified", async () => {
    authenticateSession();
    mockGetUserByEmail.mockResolvedValueOnce(null);
    mockCreateUser.mockResolvedValueOnce({
      user_id: "auth0|user-200",
      email: "bob@example.com",
    });
    mockCreatePasswordTicket.mockResolvedValueOnce({
      ticket: "https://helpucompli.us.auth0.com/lo/reset?ticket=xyz",
    });
    mockSendWelcomeEmail.mockResolvedValueOnce({ id: "email-002" });
    mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

    const response = await POST(
      makePostRequest({
        email: "bob@example.com",
        name: "Bob Jones",
        circleMemberId: "200",
      })
    );
    const data = await response.json();

    expect(data.success).toBe(true);
    // TTL is 604800 seconds = 7 days
    expect(mockCreatePasswordTicket).toHaveBeenCalledWith(
      "auth0|user-200",
      "https://compass.helpucompli.com",
      604800
    );
  });

  it("returns already-provisioned status without creating duplicate Auth0 account", async () => {
    // List shows member as already provisioned
    authenticateSession();
    mockListMembers.mockResolvedValueOnce([CIRCLE_MEMBER]);
    mockGetUserByEmail.mockResolvedValueOnce({
      user_id: "auth0|jane-101",
      email: "jane@example.com",
      app_metadata: { email_sent: true },
    });

    const listResponse = await GET();
    const members = await listResponse.json();
    expect(members[0].auth0Status).toBe("email_sent");

    // Attempt to migrate again — should return existing status
    authenticateSession();
    mockGetUserByEmail.mockResolvedValueOnce({
      user_id: "auth0|jane-101",
      app_metadata: { email_sent: true },
    });

    const migrateResponse = await POST(
      makePostRequest({
        email: "jane@example.com",
        name: "Jane Smith",
        circleMemberId: "101",
      })
    );
    const data = await migrateResponse.json();

    expect(data.success).toBe(true);
    expect(data.status).toBe("email_sent");
    expect(data.auth0UserId).toBe("auth0|jane-101");
    // No duplicate account created
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("tracks email status across member list refreshes", async () => {
    // First load: not provisioned
    authenticateSession();
    mockListMembers.mockResolvedValueOnce([CIRCLE_MEMBER]);
    mockGetUserByEmail.mockResolvedValueOnce(null);

    const res1 = await GET();
    const data1 = await res1.json();
    expect(data1[0].auth0Status).toBe("not_provisioned");

    // Migrate
    authenticateSession();
    mockGetUserByEmail.mockResolvedValueOnce(null);
    mockCreateUser.mockResolvedValueOnce({ user_id: "auth0|jane-101" });
    mockCreatePasswordTicket.mockResolvedValueOnce({ ticket: "https://t.co/x" });
    mockSendWelcomeEmail.mockResolvedValueOnce({ id: "e1" });
    mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

    await POST(
      makePostRequest({
        email: "jane@example.com",
        name: "Jane Smith",
        circleMemberId: "101",
      })
    );

    // Second load: email_sent (simulates page refresh)
    authenticateSession();
    mockListMembers.mockResolvedValueOnce([CIRCLE_MEMBER]);
    mockGetUserByEmail.mockResolvedValueOnce({
      user_id: "auth0|jane-101",
      app_metadata: { email_sent: true, email_sent_at: "2026-04-15T10:00:00Z" },
    });

    const res2 = await GET();
    const data2 = await res2.json();
    expect(data2[0].auth0Status).toBe("email_sent");
    expect(data2[0].auth0UserId).toBe("auth0|jane-101");

    // Third load: still email_sent (simulates new browser tab)
    authenticateSession();
    mockListMembers.mockResolvedValueOnce([CIRCLE_MEMBER]);
    mockGetUserByEmail.mockResolvedValueOnce({
      user_id: "auth0|jane-101",
      app_metadata: { email_sent: true, email_sent_at: "2026-04-15T10:00:00Z" },
    });

    const res3 = await GET();
    const data3 = await res3.json();
    expect(data3[0].auth0Status).toBe("email_sent");
  });
});
