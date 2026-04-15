/**
 * F019 — Duplicate detection: migrating an already-provisioned member shows correct status
 *
 * Verifies:
 * 1. Migrating a member who already has Auth0 account returns already-provisioned
 * 2. No duplicate Auth0 account is created
 * 3. Status badge shows correct state
 * 4. Works via both direct API call and simulated UI button flow
 */

// --- Mock Auth0 SDK ---
jest.mock("@auth0/nextjs-auth0/server", () => ({
  Auth0Client: jest.fn().mockImplementation(() => ({
    middleware: jest.fn(),
    getSession: jest.fn(),
  })),
}));

import { GET as getMembers } from "../circle/members/route";
import { POST as migrateUser } from "../provision/migrate/route";
import { NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0";

const mockGetSession = auth0.getSession as jest.Mock;

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

const EXISTING_AUTH0_USER = {
  user_id: "auth0|already-123",
  email: "existing@example.com",
  name: "Existing User",
  app_metadata: {
    email_sent: true,
    email_sent_at: "2026-04-10T09:00:00Z",
    source: "admin_provisioning",
    circle_member_id: "301",
  },
};

const CIRCLE_MEMBER = {
  id: 301,
  email: "existing@example.com",
  name: "Existing User",
  first_name: "Existing",
  last_name: "User",
  avatar_url: null,
  headline: null,
  created_at: "2025-06-01T00:00:00.000Z",
  last_seen_at: "2026-04-01T00:00:00.000Z",
  active: true,
  public_uid: "uid-301",
  user_id: 301,
  community_id: 12345,
  member_tags: [],
  posts_count: 10,
  comments_count: 5,
};

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3001/api/provision/migrate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function authenticateSession() {
  mockGetSession.mockResolvedValueOnce({
    user: { sub: "auth0|admin-1", email: "admin@helpucompli.com" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("F019: Duplicate detection", () => {
  it("returns existing status without creating duplicate via direct API call", async () => {
    authenticateSession();
    mockGetUserByEmail.mockResolvedValueOnce(EXISTING_AUTH0_USER);

    const response = await migrateUser(
      makePostRequest({
        email: "existing@example.com",
        name: "Existing User",
        circleMemberId: "301",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe("email_sent");
    expect(data.auth0UserId).toBe("auth0|already-123");
    expect(data.emailSent).toBe(true);

    // No duplicate account created
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockCreatePasswordTicket).not.toHaveBeenCalled();
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
    expect(mockUpdateUserMetadata).not.toHaveBeenCalled();
  });

  it("simulates UI button flow: list shows provisioned → migrate returns existing", async () => {
    // Step 1: List members — member already shows as email_sent
    authenticateSession();
    mockListMembers.mockResolvedValueOnce([CIRCLE_MEMBER]);
    mockGetUserByEmail.mockResolvedValueOnce(EXISTING_AUTH0_USER);

    const listResponse = await getMembers();
    const members = await listResponse.json();

    expect(members).toHaveLength(1);
    expect(members[0].auth0Status).toBe("email_sent");
    expect(members[0].auth0UserId).toBe("auth0|already-123");

    // Step 2: User clicks "Migrate" anyway (UI would disable this, but API should handle it)
    authenticateSession();
    mockGetUserByEmail.mockResolvedValueOnce(EXISTING_AUTH0_USER);

    const migrateResponse = await migrateUser(
      makePostRequest({
        email: "existing@example.com",
        name: "Existing User",
        circleMemberId: "301",
      })
    );
    const migrateData = await migrateResponse.json();

    expect(migrateData.success).toBe(true);
    expect(migrateData.status).toBe("email_sent");
    expect(mockCreateUser).not.toHaveBeenCalled();

    // Step 3: List again — status unchanged, still email_sent
    authenticateSession();
    mockListMembers.mockResolvedValueOnce([CIRCLE_MEMBER]);
    mockGetUserByEmail.mockResolvedValueOnce(EXISTING_AUTH0_USER);

    const listResponse2 = await getMembers();
    const members2 = await listResponse2.json();

    expect(members2[0].auth0Status).toBe("email_sent");
    expect(members2[0].auth0UserId).toBe("auth0|already-123");
  });

  it("handles auth0_created user (email not sent) without creating duplicate", async () => {
    const auth0UserNoEmail = {
      ...EXISTING_AUTH0_USER,
      user_id: "auth0|partial-456",
      app_metadata: { source: "admin_provisioning", email_sent: false },
    };

    authenticateSession();
    mockGetUserByEmail.mockResolvedValueOnce(auth0UserNoEmail);

    const response = await migrateUser(
      makePostRequest({
        email: "existing@example.com",
        name: "Existing User",
        circleMemberId: "301",
      })
    );
    const data = await response.json();

    // Returns existing user info — does not create duplicate
    expect(data.success).toBe(true);
    expect(data.auth0UserId).toBe("auth0|partial-456");
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("handles repeated migrate calls idempotently", async () => {
    // Call migrate 3 times for the same user
    for (let i = 0; i < 3; i++) {
      authenticateSession();
      mockGetUserByEmail.mockResolvedValueOnce(EXISTING_AUTH0_USER);

      const response = await migrateUser(
        makePostRequest({
          email: "existing@example.com",
          name: "Existing User",
          circleMemberId: "301",
        })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.auth0UserId).toBe("auth0|already-123");
    }

    // createUser should never have been called
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });
});
