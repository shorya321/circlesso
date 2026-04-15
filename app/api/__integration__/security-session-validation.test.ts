/**
 * F020 — Security: All API routes validate Auth0 session AND admin role
 *
 * Verifies for every route (5 total):
 * 1. Unauthenticated → 401 (no session)
 * 2. Authenticated but not admin → 403 (Forbidden)
 * 3. Admin → 200 (proceeds normally)
 * 4. Business logic is NOT reached for unauthenticated/non-admin requests
 * 5. POST routes still validate request body (Zod) for admin requests
 */

// --- Mock Auth0 SDK ---
jest.mock("@auth0/nextjs-auth0/server", () => ({
  Auth0Client: jest.fn().mockImplementation(() => ({
    middleware: jest.fn(),
    getSession: jest.fn(),
  })),
}));

import { GET as getMembers } from "../circle/members/route";
import { GET as getAccessGroups } from "../circle/access-groups/route";
import { GET as getStatus } from "../status/route";
import { POST as migrateUser } from "../provision/migrate/route";
import { POST as createMember } from "../provision/create/route";
import { POST as retryEmail } from "../provision/retry-email/route";
import { NextRequest } from "next/server";

// --- Mock admin check ---
const mockCheckAdminAccess = jest.fn();
jest.mock("@/lib/admin-check", () => ({
  checkAdminAccess: (...args: unknown[]) => mockCheckAdminAccess(...args),
}));

const ADMIN_ACCESS = {
  isAuthenticated: true,
  isAdmin: true,
  userId: "auth0|admin-1",
  email: "admin@helpucompli.com",
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
  userId: "auth0|user-1",
  email: "user@example.com",
};

// --- Mock config ---
jest.mock("@/lib/config", () => ({
  getConfig: () => ({
    CIRCLE_COMMUNITY_ID: "12345",
    PASSWORD_TICKET_RESULT_URL: "https://compass.helpucompli.com",
    PASSWORD_TICKET_TTL: 604800,
  }),
}));

// --- Mock all external APIs (needed for authenticated requests) ---
const mockListMembers = jest.fn();
const mockListAccessGroups = jest.fn();
const mockCreateMemberCircle = jest.fn();
const mockAddMemberToGroup = jest.fn();
jest.mock("@/lib/circle-api", () => ({
  listMembers: (...args: unknown[]) => mockListMembers(...args),
  listAccessGroups: (...args: unknown[]) => mockListAccessGroups(...args),
  createMember: (...args: unknown[]) => mockCreateMemberCircle(...args),
  addMemberToGroup: (...args: unknown[]) => mockAddMemberToGroup(...args),
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

function makePostRequest(url: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost:3001${url}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("F020: API route session + admin role validation", () => {
  describe("Unauthenticated requests return 401", () => {
    beforeEach(() => {
      mockCheckAdminAccess.mockResolvedValue(NO_SESSION);
    });

    it("GET /api/circle/members — 401 without session", async () => {
      const response = await getMembers();
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("GET /api/circle/access-groups — 401 without session", async () => {
      const response = await getAccessGroups();
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("GET /api/status — 401 without session", async () => {
      const response = await getStatus();
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("POST /api/provision/migrate — 401 without session", async () => {
      const response = await migrateUser(
        makePostRequest("/api/provision/migrate", {
          email: "test@example.com",
          name: "Test",
          circleMemberId: "1",
        })
      );
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("POST /api/provision/create — 401 without session", async () => {
      const response = await createMember(
        makePostRequest("/api/provision/create", {
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          accessGroupId: 10,
        })
      );
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("POST /api/provision/retry-email — 401 without session", async () => {
      const response = await retryEmail(
        makePostRequest("/api/provision/retry-email", {
          email: "test@example.com",
          name: "Test",
          auth0UserId: "auth0|abc",
        })
      );
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("Authenticated but non-admin users return 403", () => {
    beforeEach(() => {
      mockCheckAdminAccess.mockResolvedValue(NON_ADMIN_ACCESS);
    });

    it("GET /api/circle/members — 403 for non-admin", async () => {
      const response = await getMembers();
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain("admin");
    });

    it("GET /api/circle/access-groups — 403 for non-admin", async () => {
      const response = await getAccessGroups();
      expect(response.status).toBe(403);
    });

    it("GET /api/status — 403 for non-admin", async () => {
      const response = await getStatus();
      expect(response.status).toBe(403);
    });

    it("POST /api/provision/migrate — 403 for non-admin", async () => {
      const response = await migrateUser(
        makePostRequest("/api/provision/migrate", {
          email: "test@example.com",
          name: "Test",
          circleMemberId: "1",
        })
      );
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain("admin");
    });

    it("POST /api/provision/create — 403 for non-admin", async () => {
      const response = await createMember(
        makePostRequest("/api/provision/create", {
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          accessGroupId: 10,
        })
      );
      expect(response.status).toBe(403);
    });

    it("POST /api/provision/retry-email — 403 for non-admin", async () => {
      const response = await retryEmail(
        makePostRequest("/api/provision/retry-email", {
          email: "test@example.com",
          name: "Test",
          auth0UserId: "auth0|abc",
        })
      );
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain("admin");
    });
  });

  describe("Unauthenticated requests do NOT reach business logic", () => {
    beforeEach(() => {
      mockCheckAdminAccess.mockResolvedValue(NO_SESSION);
    });

    it("no Circle.so API calls made without session", async () => {
      await getMembers();
      await getAccessGroups();
      await getStatus();

      expect(mockListMembers).not.toHaveBeenCalled();
      expect(mockListAccessGroups).not.toHaveBeenCalled();
    });

    it("no Auth0 Management API calls made without session", async () => {
      await migrateUser(
        makePostRequest("/api/provision/migrate", {
          email: "test@example.com",
          name: "Test",
          circleMemberId: "1",
        })
      );
      await createMember(
        makePostRequest("/api/provision/create", {
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          accessGroupId: 10,
        })
      );
      await retryEmail(
        makePostRequest("/api/provision/retry-email", {
          email: "test@example.com",
          name: "Test",
          auth0UserId: "auth0|abc",
        })
      );

      expect(mockGetUserByEmail).not.toHaveBeenCalled();
      expect(mockCreateUser).not.toHaveBeenCalled();
      expect(mockCreatePasswordTicket).not.toHaveBeenCalled();
      expect(mockUpdateUserMetadata).not.toHaveBeenCalled();
      expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
    });
  });

  describe("Non-admin requests do NOT reach business logic", () => {
    beforeEach(() => {
      mockCheckAdminAccess.mockResolvedValue(NON_ADMIN_ACCESS);
    });

    it("no Circle.so or Auth0 calls when non-admin hits any route", async () => {
      await getMembers();
      await getAccessGroups();
      await getStatus();
      await migrateUser(
        makePostRequest("/api/provision/migrate", {
          email: "test@example.com",
          name: "Test",
          circleMemberId: "1",
        })
      );
      await createMember(
        makePostRequest("/api/provision/create", {
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          accessGroupId: 10,
        })
      );
      await retryEmail(
        makePostRequest("/api/provision/retry-email", {
          email: "test@example.com",
          name: "Test",
          auth0UserId: "auth0|abc",
        })
      );

      expect(mockListMembers).not.toHaveBeenCalled();
      expect(mockListAccessGroups).not.toHaveBeenCalled();
      expect(mockGetUserByEmail).not.toHaveBeenCalled();
      expect(mockCreateUser).not.toHaveBeenCalled();
      expect(mockCreateMemberCircle).not.toHaveBeenCalled();
      expect(mockCreatePasswordTicket).not.toHaveBeenCalled();
      expect(mockUpdateUserMetadata).not.toHaveBeenCalled();
      expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
    });
  });

  describe("Admin requests proceed normally", () => {
    it("GET /api/circle/members — 200 for admin", async () => {
      mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
      mockListMembers.mockResolvedValueOnce([]);

      const response = await getMembers();
      expect(response.status).toBe(200);
    });

    it("GET /api/circle/access-groups — 200 for admin", async () => {
      mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
      mockListAccessGroups.mockResolvedValueOnce([]);

      const response = await getAccessGroups();
      expect(response.status).toBe(200);
    });

    it("GET /api/status — 200 for admin", async () => {
      mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
      mockListMembers.mockResolvedValueOnce([]);

      const response = await getStatus();
      expect(response.status).toBe(200);
    });

    it("POST /api/provision/migrate — 200 for admin", async () => {
      mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
      mockGetUserByEmail.mockResolvedValueOnce({
        user_id: "auth0|existing",
        app_metadata: { email_sent: true },
      });

      const response = await migrateUser(
        makePostRequest("/api/provision/migrate", {
          email: "test@example.com",
          name: "Test",
          circleMemberId: "1",
        })
      );
      expect(response.status).toBe(200);
    });

    it("POST /api/provision/create — 200 for admin", async () => {
      mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
      mockCreateMemberCircle.mockResolvedValueOnce({
        id: 1,
        email: "test@example.com",
        name: "Test User",
        community_id: 12345,
      });
      mockAddMemberToGroup.mockResolvedValueOnce(undefined);
      mockCreateUser.mockResolvedValueOnce({ user_id: "auth0|new" });
      mockCreatePasswordTicket.mockResolvedValueOnce({ ticket: "https://t.co/x" });
      mockSendWelcomeEmail.mockResolvedValueOnce({ id: "e1" });
      mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

      const response = await createMember(
        makePostRequest("/api/provision/create", {
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          accessGroupId: 10,
        })
      );
      expect(response.status).toBe(200);
    });

    it("POST /api/provision/retry-email — 200 for admin", async () => {
      mockCheckAdminAccess.mockResolvedValueOnce(ADMIN_ACCESS);
      mockCreatePasswordTicket.mockResolvedValueOnce({
        ticket: "https://t.co/fresh",
      });
      mockSendWelcomeEmail.mockResolvedValueOnce({ id: "e2" });
      mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

      const response = await retryEmail(
        makePostRequest("/api/provision/retry-email", {
          email: "test@example.com",
          name: "Test",
          auth0UserId: "auth0|abc",
        })
      );
      expect(response.status).toBe(200);
    });
  });

  describe("Request body validation (admin-authenticated)", () => {
    beforeEach(() => {
      mockCheckAdminAccess.mockResolvedValue(ADMIN_ACCESS);
    });

    it("POST /api/provision/migrate — 400 on invalid body", async () => {
      const response = await migrateUser(
        makePostRequest("/api/provision/migrate", { email: "not-valid" })
      );
      expect(response.status).toBe(400);
    });

    it("POST /api/provision/create — 400 on invalid body", async () => {
      const response = await createMember(
        makePostRequest("/api/provision/create", { email: "not-valid" })
      );
      expect(response.status).toBe(400);
    });

    it("POST /api/provision/migrate — 400 on empty body", async () => {
      const response = await migrateUser(
        makePostRequest("/api/provision/migrate", {})
      );
      expect(response.status).toBe(400);
    });

    it("POST /api/provision/create — 400 on missing required fields", async () => {
      const response = await createMember(
        makePostRequest("/api/provision/create", {
          firstName: "Test",
          // missing lastName, email, accessGroupId
        })
      );
      expect(response.status).toBe(400);
    });

    it("POST /api/provision/retry-email — 400 on missing auth0UserId", async () => {
      const response = await retryEmail(
        makePostRequest("/api/provision/retry-email", {
          email: "test@example.com",
          name: "Test",
          // missing auth0UserId
        })
      );
      expect(response.status).toBe(400);
    });

    it("POST /api/provision/retry-email — 400 on invalid email", async () => {
      const response = await retryEmail(
        makePostRequest("/api/provision/retry-email", {
          email: "not-an-email",
          name: "Test",
          auth0UserId: "auth0|abc",
        })
      );
      expect(response.status).toBe(400);
    });
  });
});
