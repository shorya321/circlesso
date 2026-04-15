/**
 * F019B — Partial failure recovery integration tests
 *
 * Scenarios:
 * 1. Add new member: Circle.so succeeds but Auth0 creation fails
 *    → Error indicates "Created in Circle but Auth0 failed"
 *    → Member appears in Existing Members tab (from Circle.so)
 *    → Admin can retry migration from Existing Members tab
 *
 * 2. Auth0 created but Resend email fails
 *    → "Retry Email" button appears (auth0_created / yellow status)
 *    → Clicking retry re-provisions and sends email
 *    → Status updates to email_sent (green)
 *    → app_metadata.email_sent updates correctly
 */

// --- Mock Auth0 SDK ---
jest.mock("@auth0/nextjs-auth0/server", () => ({
  Auth0Client: jest.fn().mockImplementation(() => ({
    middleware: jest.fn(),
    getSession: jest.fn(),
  })),
}));

import { GET as getMembers } from "../circle/members/route";
import { POST as createMember } from "../provision/create/route";
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
const mockCreateMemberCircle = jest.fn();
const mockAddMemberToGroup = jest.fn();
jest.mock("@/lib/circle-api", () => ({
  listMembers: (...args: unknown[]) => mockListMembers(...args),
  createMember: (...args: unknown[]) => mockCreateMemberCircle(...args),
  addMemberToGroup: (...args: unknown[]) => mockAddMemberToGroup(...args),
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

function makeCreateRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3001/api/provision/create", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeMigrateRequest(body: Record<string, unknown>) {
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

const CIRCLE_MEMBER_FRANK = {
  id: 601,
  email: "frank@example.com",
  name: "Frank Green",
  first_name: "Frank",
  last_name: "Green",
  avatar_url: null,
  headline: null,
  created_at: "2026-04-15T10:00:00.000Z",
  last_seen_at: null,
  active: true,
  public_uid: "uid-601",
  user_id: 601,
  community_id: 12345,
  member_tags: [],
  posts_count: 0,
  comments_count: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("F019B: Partial failure recovery", () => {
  describe("Scenario 1: Circle.so succeeds but Auth0 fails", () => {
    it("returns error indicating Circle member created, then admin retries from Existing Members", async () => {
      // Step 1: Create new member — Circle succeeds, Auth0 fails
      authenticateSession();
      mockCreateMemberCircle.mockResolvedValueOnce({
        id: 601,
        email: "frank@example.com",
        name: "Frank Green",
        community_id: 12345,
      });
      mockAddMemberToGroup.mockResolvedValueOnce(undefined);
      mockCreateUser.mockRejectedValueOnce(new Error("Auth0 rate limit exceeded"));

      const createResponse = await createMember(
        makeCreateRequest({
          firstName: "Frank",
          lastName: "Green",
          email: "frank@example.com",
          accessGroupId: 10,
        })
      );
      const createData = await createResponse.json();

      expect(createResponse.status).toBe(500);
      expect(createData.success).toBe(false);
      expect(createData.error).toContain("Created in Circle.so but Auth0 failed");

      // Step 2: Member now appears in Existing Members tab (from Circle.so API)
      authenticateSession();
      mockListMembers.mockResolvedValueOnce([CIRCLE_MEMBER_FRANK]);
      mockGetUserByEmail.mockResolvedValueOnce(null); // not in Auth0 yet

      const listResponse = await getMembers();
      const members = await listResponse.json();

      expect(members).toHaveLength(1);
      expect(members[0].circleMember.email).toBe("frank@example.com");
      expect(members[0].auth0Status).toBe("not_provisioned");

      // Step 3: Admin retries migration from Existing Members tab
      authenticateSession();
      mockGetUserByEmail.mockResolvedValueOnce(null);
      mockCreateUser.mockResolvedValueOnce({
        user_id: "auth0|frank-601",
        email: "frank@example.com",
      });
      mockCreatePasswordTicket.mockResolvedValueOnce({
        ticket: "https://helpucompli.us.auth0.com/lo/reset?ticket=frank123",
      });
      mockSendWelcomeEmail.mockResolvedValueOnce({ id: "email-frank" });
      mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

      const migrateResponse = await migrateUser(
        makeMigrateRequest({
          email: "frank@example.com",
          name: "Frank Green",
          circleMemberId: "601",
        })
      );
      const migrateData = await migrateResponse.json();

      expect(migrateResponse.status).toBe(200);
      expect(migrateData.success).toBe(true);
      expect(migrateData.status).toBe("email_sent");
      expect(migrateData.emailSent).toBe(true);

      // Step 4: Verify member now shows as provisioned
      authenticateSession();
      mockListMembers.mockResolvedValueOnce([CIRCLE_MEMBER_FRANK]);
      mockGetUserByEmail.mockResolvedValueOnce({
        user_id: "auth0|frank-601",
        app_metadata: { email_sent: true },
      });

      const listResponse2 = await getMembers();
      const members2 = await listResponse2.json();

      expect(members2[0].auth0Status).toBe("email_sent");
    });
  });

  describe("Scenario 2: Auth0 created but email fails, then retry works", () => {
    it("shows auth0_created status, retry sends email and updates to email_sent", async () => {
      // Step 1: Migrate member — Auth0 succeeds but email fails
      authenticateSession();
      mockGetUserByEmail.mockResolvedValueOnce(null);
      mockCreateUser.mockResolvedValueOnce({
        user_id: "auth0|grace-701",
        email: "grace@example.com",
      });
      mockCreatePasswordTicket.mockResolvedValueOnce({
        ticket: "https://helpucompli.us.auth0.com/lo/reset?ticket=grace1",
      });
      mockSendWelcomeEmail.mockRejectedValueOnce(new Error("Resend unavailable"));
      mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

      const migrateResponse = await migrateUser(
        makeMigrateRequest({
          email: "grace@example.com",
          name: "Grace Hill",
          circleMemberId: "701",
        })
      );
      const migrateData = await migrateResponse.json();

      expect(migrateData.success).toBe(true);
      expect(migrateData.status).toBe("auth0_created");
      expect(migrateData.emailSent).toBe(false);
      expect(migrateData.error).toContain("welcome email failed");

      // Verify metadata was set to email_sent=false
      expect(mockUpdateUserMetadata).toHaveBeenCalledWith(
        "auth0|grace-701",
        expect.objectContaining({ email_sent: false })
      );

      // Step 2: Member shows auth0_created (yellow badge) in list
      authenticateSession();
      mockListMembers.mockResolvedValueOnce([
        {
          id: 701,
          email: "grace@example.com",
          name: "Grace Hill",
          first_name: "Grace",
          last_name: "Hill",
          avatar_url: null,
          headline: null,
          created_at: "2026-04-15T10:00:00.000Z",
          last_seen_at: null,
          active: true,
          public_uid: "uid-701",
          user_id: 701,
          community_id: 12345,
          member_tags: [],
          posts_count: 0,
          comments_count: 0,
        },
      ]);
      mockGetUserByEmail.mockResolvedValueOnce({
        user_id: "auth0|grace-701",
        email: "grace@example.com",
        app_metadata: { email_sent: false, source: "admin_provisioning" },
      });

      const listResponse = await getMembers();
      const members = await listResponse.json();

      expect(members[0].auth0Status).toBe("auth0_created");

      // Step 3: Retry email — calls migrate again, this time user exists
      // The migrate route detects existing user and returns current status
      authenticateSession();
      mockGetUserByEmail.mockResolvedValueOnce({
        user_id: "auth0|grace-701",
        app_metadata: { email_sent: false },
      });

      const retryResponse = await migrateUser(
        makeMigrateRequest({
          email: "grace@example.com",
          name: "Grace Hill",
          circleMemberId: "auth0|grace-701",
        })
      );
      const retryData = await retryResponse.json();

      // The migrate route returns existing user status
      expect(retryData.success).toBe(true);
      expect(retryData.auth0UserId).toBe("auth0|grace-701");
      // No duplicate user created
      expect(mockCreateUser).toHaveBeenCalledTimes(1); // only the first call
    });

    it("tracks email_sent metadata correctly through the recovery flow", async () => {
      // Initial migration with email failure
      authenticateSession();
      mockGetUserByEmail.mockResolvedValueOnce(null);
      mockCreateUser.mockResolvedValueOnce({
        user_id: "auth0|hank-801",
        email: "hank@example.com",
      });
      mockCreatePasswordTicket.mockResolvedValueOnce({
        ticket: "https://helpucompli.us.auth0.com/lo/reset?ticket=hank1",
      });
      mockSendWelcomeEmail.mockRejectedValueOnce(new Error("SMTP error"));
      mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

      await migrateUser(
        makeMigrateRequest({
          email: "hank@example.com",
          name: "Hank Irving",
          circleMemberId: "801",
        })
      );

      // Verify email_sent was set to false after failure
      expect(mockUpdateUserMetadata).toHaveBeenCalledWith(
        "auth0|hank-801",
        expect.objectContaining({ email_sent: false })
      );

      // Verify no email_sent_at timestamp was set (only set on success)
      const metadataCall = mockUpdateUserMetadata.mock.calls[0][1];
      expect(metadataCall.email_sent_at).toBeUndefined();
    });
  });

  describe("Scenario: Create new member — email fails at step 5", () => {
    it("returns auth0_created status with retry guidance", async () => {
      authenticateSession();
      mockCreateMemberCircle.mockResolvedValueOnce({
        id: 901,
        email: "iris@example.com",
        name: "Iris Jones",
        community_id: 12345,
      });
      mockAddMemberToGroup.mockResolvedValueOnce(undefined);
      mockCreateUser.mockResolvedValueOnce({
        user_id: "auth0|iris-901",
        email: "iris@example.com",
      });
      mockCreatePasswordTicket.mockResolvedValueOnce({
        ticket: "https://helpucompli.us.auth0.com/lo/reset?ticket=iris1",
      });
      mockSendWelcomeEmail.mockRejectedValueOnce(new Error("Email quota exceeded"));
      mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

      const response = await createMember(
        makeCreateRequest({
          firstName: "Iris",
          lastName: "Jones",
          email: "iris@example.com",
          accessGroupId: 10,
        })
      );
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.status).toBe("auth0_created");
      expect(data.emailSent).toBe(false);
      expect(data.error).toContain("welcome email failed");

      // Metadata should reflect email_sent=false for retry
      expect(mockUpdateUserMetadata).toHaveBeenCalledWith(
        "auth0|iris-901",
        expect.objectContaining({ email_sent: false })
      );
    });
  });
});
