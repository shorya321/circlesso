/**
 * F019C — Email status tracking persists across page refreshes via Auth0 app_metadata
 *
 * Verifies:
 * 1. Migrate a member → status shows "email_sent" (green)
 * 2. Refresh the page → status still shows "email_sent" (not reset)
 * 3. Open in a new browser tab → same status
 * 4. Auth0 app_metadata has email_sent=true and email_sent_at
 * 5. Status derivation: no Auth0 user = red, Auth0 without email_sent = yellow, with email_sent = green
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

jest.mock("@/lib/config", () => ({
  getConfig: () => ({
    CIRCLE_COMMUNITY_ID: "12345",
    PASSWORD_TICKET_RESULT_URL: "https://compass.helpucompli.com",
    PASSWORD_TICKET_TTL: 604800,
  }),
}));

const mockListMembers = jest.fn();
jest.mock("@/lib/circle-api", () => ({
  listMembers: (...args: unknown[]) => mockListMembers(...args),
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

// --- Helpers ---

const CIRCLE_MEMBERS = [
  {
    id: 1, email: "alice@example.com", name: "Alice",
    first_name: "Alice", last_name: null, avatar_url: null, headline: null,
    created_at: "2025-01-01T00:00:00Z", last_seen_at: null, active: true,
    public_uid: "uid-1", user_id: 1, community_id: 12345,
    member_tags: [], posts_count: 0, comments_count: 0,
  },
  {
    id: 2, email: "bob@example.com", name: "Bob",
    first_name: "Bob", last_name: null, avatar_url: null, headline: null,
    created_at: "2025-01-01T00:00:00Z", last_seen_at: null, active: true,
    public_uid: "uid-2", user_id: 2, community_id: 12345,
    member_tags: [], posts_count: 0, comments_count: 0,
  },
  {
    id: 3, email: "carol@example.com", name: "Carol",
    first_name: "Carol", last_name: null, avatar_url: null, headline: null,
    created_at: "2025-01-01T00:00:00Z", last_seen_at: null, active: true,
    public_uid: "uid-3", user_id: 3, community_id: 12345,
    member_tags: [], posts_count: 0, comments_count: 0,
  },
];

function authenticateSession() {
  mockGetSession.mockResolvedValueOnce({
    user: { sub: "auth0|admin-1", email: "admin@helpucompli.com" },
  });
}

function makeMigrateRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3001/api/provision/migrate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("F019C: Email status persistence via app_metadata", () => {
  it("derives correct status colors: red (not_provisioned), yellow (auth0_created), green (email_sent)", async () => {
    authenticateSession();
    mockListMembers.mockResolvedValueOnce(CIRCLE_MEMBERS);

    // Alice: no Auth0 user → not_provisioned (red)
    mockGetUserByEmail.mockResolvedValueOnce(null);

    // Bob: Auth0 user, email_sent=false → auth0_created (yellow)
    mockGetUserByEmail.mockResolvedValueOnce({
      user_id: "auth0|bob-2",
      email: "bob@example.com",
      app_metadata: { email_sent: false, source: "admin_provisioning" },
    });

    // Carol: Auth0 user, email_sent=true → email_sent (green)
    mockGetUserByEmail.mockResolvedValueOnce({
      user_id: "auth0|carol-3",
      email: "carol@example.com",
      app_metadata: { email_sent: true, email_sent_at: "2026-04-10T09:00:00Z" },
    });

    const response = await getMembers();
    const members = await response.json();

    expect(members).toHaveLength(3);

    // Red: not provisioned
    expect(members[0].circleMember.email).toBe("alice@example.com");
    expect(members[0].auth0Status).toBe("not_provisioned");
    expect(members[0].auth0UserId).toBeNull();

    // Yellow: auth0 created but email not sent
    expect(members[1].circleMember.email).toBe("bob@example.com");
    expect(members[1].auth0Status).toBe("auth0_created");
    expect(members[1].auth0UserId).toBe("auth0|bob-2");

    // Green: email sent
    expect(members[2].circleMember.email).toBe("carol@example.com");
    expect(members[2].auth0Status).toBe("email_sent");
    expect(members[2].auth0UserId).toBe("auth0|carol-3");
  });

  it("status persists across page refreshes (multiple GET calls)", async () => {
    // Migrate Alice
    authenticateSession();
    mockGetUserByEmail.mockResolvedValueOnce(null);
    mockCreateUser.mockResolvedValueOnce({ user_id: "auth0|alice-1" });
    mockCreatePasswordTicket.mockResolvedValueOnce({ ticket: "https://t.co/x" });
    mockSendWelcomeEmail.mockResolvedValueOnce({ id: "e1" });
    mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

    const migrateRes = await migrateUser(
      makeMigrateRequest({
        email: "alice@example.com",
        name: "Alice",
        circleMemberId: "1",
      })
    );
    const migrateData = await migrateRes.json();
    expect(migrateData.status).toBe("email_sent");

    // Verify updateUserMetadata was called with email_sent=true and email_sent_at
    expect(mockUpdateUserMetadata).toHaveBeenCalledWith(
      "auth0|alice-1",
      expect.objectContaining({
        email_sent: true,
        email_sent_at: expect.any(String),
      })
    );

    const auth0AliceProvisioned = {
      user_id: "auth0|alice-1",
      email: "alice@example.com",
      app_metadata: { email_sent: true, email_sent_at: "2026-04-15T10:00:00Z" },
    };

    // Refresh 1: status persists
    authenticateSession();
    mockListMembers.mockResolvedValueOnce([CIRCLE_MEMBERS[0]]);
    mockGetUserByEmail.mockResolvedValueOnce(auth0AliceProvisioned);

    const res1 = await getMembers();
    const data1 = await res1.json();
    expect(data1[0].auth0Status).toBe("email_sent");
    expect(data1[0].auth0UserId).toBe("auth0|alice-1");

    // Refresh 2 (simulates new browser tab): status still persists
    authenticateSession();
    mockListMembers.mockResolvedValueOnce([CIRCLE_MEMBERS[0]]);
    mockGetUserByEmail.mockResolvedValueOnce(auth0AliceProvisioned);

    const res2 = await getMembers();
    const data2 = await res2.json();
    expect(data2[0].auth0Status).toBe("email_sent");
    expect(data2[0].auth0UserId).toBe("auth0|alice-1");

    // Refresh 3: still persists
    authenticateSession();
    mockListMembers.mockResolvedValueOnce([CIRCLE_MEMBERS[0]]);
    mockGetUserByEmail.mockResolvedValueOnce(auth0AliceProvisioned);

    const res3 = await getMembers();
    const data3 = await res3.json();
    expect(data3[0].auth0Status).toBe("email_sent");
  });

  it("handles missing app_metadata gracefully (defaults to auth0_created)", async () => {
    authenticateSession();
    mockListMembers.mockResolvedValueOnce([CIRCLE_MEMBERS[0]]);
    mockGetUserByEmail.mockResolvedValueOnce({
      user_id: "auth0|alice-1",
      email: "alice@example.com",
      app_metadata: {}, // no email_sent field at all
    });

    const response = await getMembers();
    const members = await response.json();

    // Missing email_sent defaults to auth0_created (yellow)
    expect(members[0].auth0Status).toBe("auth0_created");
  });
});
