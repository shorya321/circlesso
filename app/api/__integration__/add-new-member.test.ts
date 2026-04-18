/**
 * F018 — End-to-end integration test: Add one new member to Circle.so and Auth0
 *
 * Exercises the full flow:
 * 1. GET /api/circle/access-groups — fetch available groups
 * 2. POST /api/provision/create — create in Circle.so + Auth0 + send email
 * 3. GET /api/circle/members — new member appears with email_sent status
 */

// --- Mock Auth0 SDK ---
jest.mock("@auth0/nextjs-auth0/server", () => ({
  Auth0Client: jest.fn().mockImplementation(() => ({
    middleware: jest.fn(),
    getSession: jest.fn(),
  })),
}));

import { GET as getAccessGroups } from "../circle/access-groups/route";
import { GET as getMembers } from "../circle/members/route";
import { POST as createMember } from "../provision/create/route";
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
const mockCreateMember = jest.fn();
const mockListAccessGroups = jest.fn();
const mockAddMemberToGroup = jest.fn();
jest.mock("@/lib/circle-api", () => ({
  listMembers: (...args: unknown[]) => mockListMembers(...args),
  createMember: (...args: unknown[]) => mockCreateMember(...args),
  listAccessGroups: (...args: unknown[]) => mockListAccessGroups(...args),
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

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3001/api/provision/create", {
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

const ACCESS_GROUPS = [
  {
    id: 10,
    name: "Compliance Training",
    description: "Access to compliance modules",
    community_id: 12345,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-06-01T00:00:00.000Z",
  },
  {
    id: 20,
    name: "Premium Resources",
    description: "Premium content access",
    community_id: 12345,
    created_at: "2025-02-01T00:00:00.000Z",
    updated_at: "2025-06-01T00:00:00.000Z",
  },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe("F018: End-to-end add one new member", () => {
  it("completes the full flow: fetch groups → create member → verify in list", async () => {
    // ── Step 1: Fetch access groups ──
    authenticateSession();
    mockListAccessGroups.mockResolvedValueOnce(ACCESS_GROUPS);

    const groupsResponse = await getAccessGroups();
    const groups = await groupsResponse.json();

    expect(groupsResponse.status).toBe(200);
    expect(groups).toHaveLength(2);
    expect(groups[0].name).toBe("Compliance Training");
    expect(groups[1].name).toBe("Premium Resources");

    // ── Step 2: Create new member (Circle.so + Auth0 + email) ──
    authenticateSession();
    mockCreateMember.mockResolvedValueOnce({
      id: 501,
      email: "alice@newcorp.com",
      name: "Alice Johnson",
      community_id: 12345,
    });
    mockAddMemberToGroup.mockResolvedValueOnce(undefined);
    mockCreateUser.mockResolvedValueOnce({
      user_id: "auth0|alice-501",
      email: "alice@newcorp.com",
      name: "Alice Johnson",
    });
    mockCreatePasswordTicket.mockResolvedValueOnce({
      ticket: "https://helpucompli.us.auth0.com/lo/reset?ticket=new123",
    });
    mockSendWelcomeEmail.mockResolvedValueOnce({ id: "email-new-001" });
    mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

    const createResponse = await createMember(
      makePostRequest({
        firstName: "Alice",
        lastName: "Johnson",
        email: "alice@newcorp.com",
        accessGroupIds: [10],
      })
    );
    const createData = await createResponse.json();

    expect(createResponse.status).toBe(200);
    expect(createData.success).toBe(true);
    expect(createData.status).toBe("email_sent");
    expect(createData.auth0UserId).toBe("auth0|alice-501");
    expect(createData.emailSent).toBe(true);
    expect(createData.accessGroupAssigned).toBe(true);

    // Verify Circle.so member was created
    expect(mockCreateMember).toHaveBeenCalledWith(
      "12345",
      "alice@newcorp.com",
      "Alice Johnson"
    );

    // Verify access group assignment
    expect(mockAddMemberToGroup).toHaveBeenCalledWith(
      10,
      "alice@newcorp.com"
    );

    // Verify Auth0 user was created with circle_member_id
    expect(mockCreateUser).toHaveBeenCalledWith(
      "alice@newcorp.com",
      "Alice Johnson",
      expect.objectContaining({
        source: "admin_provisioning",
        circle_member_id: "501",
      })
    );

    // Verify welcome email was sent
    expect(mockSendWelcomeEmail).toHaveBeenCalledWith(
      "alice@newcorp.com",
      "Alice Johnson",
      "https://helpucompli.us.auth0.com/lo/reset?ticket=new123"
    );

    // ── Step 3: Verify new member appears in member list with email_sent status ──
    authenticateSession();
    mockListMembers.mockResolvedValueOnce([
      {
        id: 501,
        email: "alice@newcorp.com",
        name: "Alice Johnson",
        first_name: "Alice",
        last_name: "Johnson",
        avatar_url: null,
        headline: null,
        created_at: "2026-04-15T10:00:00.000Z",
        last_seen_at: null,
        active: true,
        public_uid: "uid-501",
        user_id: 501,
        community_id: 12345,
        member_tags: [],
        posts_count: 0,
        comments_count: 0,
      },
    ]);
    mockGetUserByEmail.mockResolvedValueOnce({
      user_id: "auth0|alice-501",
      email: "alice@newcorp.com",
      app_metadata: {
        email_sent: true,
        email_sent_at: "2026-04-15T10:01:00Z",
        source: "admin_provisioning",
        circle_member_id: "501",
      },
    });

    const listResponse = await getMembers();
    const members = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(members).toHaveLength(1);
    expect(members[0].circleMember.email).toBe("alice@newcorp.com");
    expect(members[0].circleMember.name).toBe("Alice Johnson");
    expect(members[0].auth0Status).toBe("email_sent");
    expect(members[0].auth0UserId).toBe("auth0|alice-501");
  });

  it("continues Auth0 provisioning when access group assignment fails", async () => {
    authenticateSession();
    mockCreateMember.mockResolvedValueOnce({
      id: 502,
      email: "bob@newcorp.com",
      name: "Bob Williams",
      community_id: 12345,
    });
    mockAddMemberToGroup.mockRejectedValueOnce(
      new Error("Access group not found")
    );
    mockCreateUser.mockResolvedValueOnce({
      user_id: "auth0|bob-502",
      email: "bob@newcorp.com",
      name: "Bob Williams",
    });
    mockCreatePasswordTicket.mockResolvedValueOnce({
      ticket: "https://helpucompli.us.auth0.com/lo/reset?ticket=bob",
    });
    mockSendWelcomeEmail.mockResolvedValueOnce({ id: "email-bob-002" });
    mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

    const response = await createMember(
      makePostRequest({
        firstName: "Bob",
        lastName: "Williams",
        email: "bob@newcorp.com",
        accessGroupIds: [999],
      })
    );
    const data = await response.json();

    // Access-group failure is a warning, not a hard error — provisioning continues.
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe("email_sent");
    expect(data.accessGroupAssigned).toBe(false);
    expect(data.warning).toContain("access group");
    expect(data.auth0UserId).toBe("auth0|bob-502");
    expect(data.emailSent).toBe(true);

    // Auth0 + ticket + email must all have fired despite access-group failure.
    expect(mockCreateUser).toHaveBeenCalledWith(
      "bob@newcorp.com",
      "Bob Williams",
      expect.objectContaining({
        source: "admin_provisioning",
        circle_member_id: "502",
      })
    );
    expect(mockCreatePasswordTicket).toHaveBeenCalled();
    expect(mockSendWelcomeEmail).toHaveBeenCalled();
  });

  it("assigns multiple access groups and reports partial failures", async () => {
    authenticateSession();
    mockCreateMember.mockResolvedValueOnce({
      id: 505,
      email: "erin@newcorp.com",
      name: "Erin Frost",
      community_id: 12345,
    });
    // 3 groups: first + third succeed, middle fails
    mockAddMemberToGroup
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Access group 20 not found"))
      .mockResolvedValueOnce(undefined);
    mockCreateUser.mockResolvedValueOnce({
      user_id: "auth0|erin-505",
      email: "erin@newcorp.com",
      name: "Erin Frost",
    });
    mockCreatePasswordTicket.mockResolvedValueOnce({
      ticket: "https://helpucompli.us.auth0.com/lo/reset?ticket=erin",
    });
    mockSendWelcomeEmail.mockResolvedValueOnce({ id: "email-erin-005" });
    mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

    const response = await createMember(
      makePostRequest({
        firstName: "Erin",
        lastName: "Frost",
        email: "erin@newcorp.com",
        accessGroupIds: [10, 20, 30],
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.accessGroupAssigned).toBe(false);
    expect(data.warning).toContain("20");
    expect(mockAddMemberToGroup).toHaveBeenCalledTimes(3);
    expect(mockAddMemberToGroup).toHaveBeenNthCalledWith(1, 10, "erin@newcorp.com");
    expect(mockAddMemberToGroup).toHaveBeenNthCalledWith(2, 20, "erin@newcorp.com");
    expect(mockAddMemberToGroup).toHaveBeenNthCalledWith(3, 30, "erin@newcorp.com");
    expect(data.emailSent).toBe(true);
  });

  it("assigns to all selected groups when all succeed", async () => {
    authenticateSession();
    mockCreateMember.mockResolvedValueOnce({
      id: 506,
      email: "frank@newcorp.com",
      name: "Frank Grove",
      community_id: 12345,
    });
    mockAddMemberToGroup
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    mockCreateUser.mockResolvedValueOnce({
      user_id: "auth0|frank-506",
      email: "frank@newcorp.com",
      name: "Frank Grove",
    });
    mockCreatePasswordTicket.mockResolvedValueOnce({
      ticket: "https://helpucompli.us.auth0.com/lo/reset?ticket=frank",
    });
    mockSendWelcomeEmail.mockResolvedValueOnce({ id: "email-frank-006" });
    mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

    const response = await createMember(
      makePostRequest({
        firstName: "Frank",
        lastName: "Grove",
        email: "frank@newcorp.com",
        accessGroupIds: [10, 20],
      })
    );
    const data = await response.json();

    expect(data.accessGroupAssigned).toBe(true);
    expect(data.warning).toBeUndefined();
    expect(mockAddMemberToGroup).toHaveBeenCalledTimes(2);
  });

  it("rejects create request with empty accessGroupIds array", async () => {
    authenticateSession();

    const response = await createMember(
      makePostRequest({
        firstName: "Gina",
        lastName: "Hall",
        email: "gina@newcorp.com",
        accessGroupIds: [],
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid request body");
    expect(mockCreateMember).not.toHaveBeenCalled();
  });

  it("reuses existing Auth0 user on 409 and still sends welcome email", async () => {
    authenticateSession();
    mockCreateMember.mockResolvedValueOnce({
      id: 700,
      email: "ivy@newcorp.com",
      name: "Ivy Gray",
      community_id: 12345,
    });
    mockAddMemberToGroup.mockResolvedValueOnce(undefined);
    mockCreateUser.mockRejectedValueOnce(new Error("User already exists"));
    mockGetUserByEmail.mockResolvedValueOnce({
      user_id: "auth0|ivy-pre-existing",
      email: "ivy@newcorp.com",
      name: "Ivy Gray",
      email_verified: true,
      created_at: "2025-12-01T00:00:00.000Z",
      app_metadata: {},
    });
    // First updateUserMetadata = link existing Auth0 user to new Circle member
    mockUpdateUserMetadata.mockResolvedValueOnce(undefined);
    mockCreatePasswordTicket.mockResolvedValueOnce({
      ticket: "https://helpucompli.us.auth0.com/lo/reset?ticket=ivy",
    });
    mockSendWelcomeEmail.mockResolvedValueOnce({ id: "email-ivy-007" });
    // Second updateUserMetadata = email_sent=true on success path
    mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

    const response = await createMember(
      makePostRequest({
        firstName: "Ivy",
        lastName: "Gray",
        email: "ivy@newcorp.com",
        accessGroupIds: [10],
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe("email_sent");
    expect(data.auth0UserId).toBe("auth0|ivy-pre-existing");
    expect(data.emailSent).toBe(true);
    expect(data.warning).toMatch(/auth0 account already existed/i);

    // Ticket + email were generated for the existing Auth0 user_id
    expect(mockCreatePasswordTicket).toHaveBeenCalledWith(
      "auth0|ivy-pre-existing",
      expect.any(String),
      expect.any(Number)
    );
    expect(mockSendWelcomeEmail).toHaveBeenCalledWith(
      "ivy@newcorp.com",
      "Ivy Gray",
      "https://helpucompli.us.auth0.com/lo/reset?ticket=ivy"
    );
    // Linked existing Auth0 user to the new Circle member id
    expect(mockUpdateUserMetadata).toHaveBeenNthCalledWith(
      1,
      "auth0|ivy-pre-existing",
      expect.objectContaining({
        source: "admin_provisioning",
        circle_member_id: "700",
      })
    );
  });

  it("returns 500 when Auth0 reports 409 but getUserByEmail returns null", async () => {
    authenticateSession();
    mockCreateMember.mockResolvedValueOnce({
      id: 710,
      email: "jack@newcorp.com",
      name: "Jack Hill",
      community_id: 12345,
    });
    mockAddMemberToGroup.mockResolvedValueOnce(undefined);
    mockCreateUser.mockRejectedValueOnce(new Error("User already exists"));
    mockGetUserByEmail.mockResolvedValueOnce(null);

    const response = await createMember(
      makePostRequest({
        firstName: "Jack",
        lastName: "Hill",
        email: "jack@newcorp.com",
        accessGroupIds: [10],
      })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/lookup returned no user/i);
    expect(mockCreatePasswordTicket).not.toHaveBeenCalled();
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("handles Auth0 creation failure after Circle.so success", async () => {
    authenticateSession();
    mockCreateMember.mockResolvedValueOnce({
      id: 503,
      email: "carol@newcorp.com",
      name: "Carol Davis",
      community_id: 12345,
    });
    mockAddMemberToGroup.mockResolvedValueOnce(undefined);
    mockCreateUser.mockRejectedValueOnce(new Error("Auth0 service unavailable"));

    const response = await createMember(
      makePostRequest({
        firstName: "Carol",
        lastName: "Davis",
        email: "carol@newcorp.com",
        accessGroupIds: [10],
      })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Created in Circle.so but Auth0 failed");
  });

  it("handles email failure — member created but needs retry", async () => {
    authenticateSession();
    mockCreateMember.mockResolvedValueOnce({
      id: 504,
      email: "dave@newcorp.com",
      name: "Dave Evans",
      community_id: 12345,
    });
    mockAddMemberToGroup.mockResolvedValueOnce(undefined);
    mockCreateUser.mockResolvedValueOnce({
      user_id: "auth0|dave-504",
      email: "dave@newcorp.com",
    });
    mockCreatePasswordTicket.mockResolvedValueOnce({
      ticket: "https://helpucompli.us.auth0.com/lo/reset?ticket=dave",
    });
    mockSendWelcomeEmail.mockRejectedValueOnce(new Error("Resend API down"));
    mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

    const response = await createMember(
      makePostRequest({
        firstName: "Dave",
        lastName: "Evans",
        email: "dave@newcorp.com",
        accessGroupIds: [10],
      })
    );
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.status).toBe("auth0_created");
    expect(data.emailSent).toBe(false);
    expect(data.error).toMatch(/welcome email failed/i);

    // Metadata should be updated with email_sent=false
    expect(mockUpdateUserMetadata).toHaveBeenCalledWith(
      "auth0|dave-504",
      expect.objectContaining({ email_sent: false })
    );
  });
});
