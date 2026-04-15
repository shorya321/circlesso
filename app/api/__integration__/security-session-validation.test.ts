/**
 * F020 — Security: All API routes validate Auth0 session before processing
 *
 * Verifies:
 * 1. Every POST /api/provision/* route checks Auth0 session → 401 if missing
 * 2. Every GET /api/circle/* route checks Auth0 session → 401 if missing
 * 3. GET /api/status checks Auth0 session → 401 if missing
 * 4. Authenticated requests proceed normally (200)
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

describe("F020: API route session validation", () => {
  describe("Unauthenticated requests return 401", () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue(null);
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
  });

  describe("Unauthenticated requests do NOT reach business logic", () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue(null);
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

      expect(mockGetUserByEmail).not.toHaveBeenCalled();
      expect(mockCreateUser).not.toHaveBeenCalled();
      expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
    });
  });

  describe("Authenticated requests proceed normally", () => {
    it("GET /api/circle/members — 200 with valid session", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { sub: "auth0|admin" } });
      mockListMembers.mockResolvedValueOnce([]);

      const response = await getMembers();
      expect(response.status).toBe(200);
    });

    it("GET /api/circle/access-groups — 200 with valid session", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { sub: "auth0|admin" } });
      mockListAccessGroups.mockResolvedValueOnce([]);

      const response = await getAccessGroups();
      expect(response.status).toBe(200);
    });

    it("GET /api/status — 200 with valid session", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { sub: "auth0|admin" } });
      mockListMembers.mockResolvedValueOnce([]);

      const response = await getStatus();
      expect(response.status).toBe(200);
    });

    it("POST /api/provision/migrate — 200 with valid session", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { sub: "auth0|admin" } });
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

    it("POST /api/provision/create — processes with valid session", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { sub: "auth0|admin" } });
      mockCreateMemberCircle.mockResolvedValueOnce({
        id: 1, email: "test@example.com", name: "Test User", community_id: 12345,
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
  });

  describe("Request body validation on POST routes", () => {
    it("POST /api/provision/migrate — 400 on invalid body", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { sub: "auth0|admin" } });

      const response = await migrateUser(
        makePostRequest("/api/provision/migrate", { email: "not-valid" })
      );
      expect(response.status).toBe(400);
    });

    it("POST /api/provision/create — 400 on invalid body", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { sub: "auth0|admin" } });

      const response = await createMember(
        makePostRequest("/api/provision/create", { email: "not-valid" })
      );
      expect(response.status).toBe(400);
    });

    it("POST /api/provision/migrate — 400 on empty body", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { sub: "auth0|admin" } });

      const response = await migrateUser(
        makePostRequest("/api/provision/migrate", {})
      );
      expect(response.status).toBe(400);
    });

    it("POST /api/provision/create — 400 on missing required fields", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { sub: "auth0|admin" } });

      const response = await createMember(
        makePostRequest("/api/provision/create", {
          firstName: "Test",
          // missing lastName, email, accessGroupId
        })
      );
      expect(response.status).toBe(400);
    });
  });
});
