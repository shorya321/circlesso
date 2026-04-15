import {
  listMembers,
  createMember,
  listAccessGroups,
  addMemberToGroup,
} from "./circle-api";

// Mock config
jest.mock("./config", () => ({
  getConfig: () => ({
    CIRCLE_API_TOKEN: "test-circle-token",
    CIRCLE_COMMUNITY_ID: "12345",
  }),
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

const makeMember = (id: number, email: string) => ({
  id,
  email,
  name: `User ${id}`,
  first_name: `User`,
  last_name: `${id}`,
  avatar_url: null,
  headline: null,
  created_at: "2026-01-01T00:00:00.000Z",
  last_seen_at: null,
  active: true,
  public_uid: `uid-${id}`,
  user_id: id,
  community_id: 12345,
  member_tags: [],
  posts_count: 0,
  comments_count: 0,
});

describe("listMembers", () => {
  it("fetches all members with pagination", async () => {
    // Page 1: has next
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        page: 1,
        per_page: 100,
        has_next_page: true,
        count: 2,
        records: [makeMember(1, "a@test.com"), makeMember(2, "b@test.com")],
      }),
    });
    // Page 2: no next
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        page: 2,
        per_page: 100,
        has_next_page: false,
        count: 1,
        records: [makeMember(3, "c@test.com")],
      }),
    });

    const members = await listMembers("12345");

    expect(members).toHaveLength(3);
    expect(members[0].email).toBe("a@test.com");
    expect(members[2].email).toBe("c@test.com");

    // Verify first call
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://app.circle.so/api/admin/v2/community_members?community_id=12345&per_page=100&page=1&status=all",
      expect.objectContaining({
        method: "GET",
        headers: {
          Authorization: "Bearer test-circle-token",
          "Content-Type": "application/json",
        },
      })
    );
    // Verify second call with page=2
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://app.circle.so/api/admin/v2/community_members?community_id=12345&per_page=100&page=2&status=all",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("returns empty array when no members", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        page: 1,
        per_page: 100,
        has_next_page: false,
        count: 0,
        records: [],
      }),
    });

    const members = await listMembers("12345");
    expect(members).toEqual([]);
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized" }),
    });

    await expect(listMembers("12345")).rejects.toThrow();
  });
});

describe("createMember", () => {
  it("creates a new community member and unwraps the community_member envelope", async () => {
    const newMember = makeMember(10, "new@test.com");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: "This user has been invited to the community.",
        community_member: newMember,
      }),
    });

    const result = await createMember("12345", "new@test.com", "New User");

    expect(result).toEqual(newMember);
    expect(result.id).toBe(10);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://app.circle.so/api/admin/v2/community_members",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          community_id: "12345",
          email: "new@test.com",
          name: "New User",
          skip_invitation: true,
        }),
      })
    );
  });

  it("throws when response is missing community_member.id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "created" }),
    });

    await expect(
      createMember("12345", "weird@test.com", "Weird")
    ).rejects.toThrow(/unexpected response shape/);
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ error: "Validation failed" }),
    });

    await expect(
      createMember("12345", "bad@test.com", "Bad")
    ).rejects.toThrow();
  });
});

describe("listAccessGroups", () => {
  it("fetches access groups for a community", async () => {
    const groups = [
      {
        id: 1,
        name: "Group A",
        description: "First group",
        community_id: 12345,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        name: "Group B",
        description: null,
        community_id: 12345,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        page: 1,
        per_page: 100,
        has_next_page: false,
        count: groups.length,
        records: groups,
      }),
    });

    const result = await listAccessGroups("12345");

    expect(result).toEqual(groups);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://app.circle.so/api/admin/v2/access_groups?community_id=12345&per_page=100",
      expect.objectContaining({
        method: "GET",
        headers: {
          Authorization: "Bearer test-circle-token",
          "Content-Type": "application/json",
        },
      })
    );
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal error" }),
    });

    await expect(listAccessGroups("12345")).rejects.toThrow();
  });
});

describe("addMemberToGroup", () => {
  it("adds a member to an access group by email", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await addMemberToGroup(1, "user@test.com");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://app.circle.so/api/admin/v2/access_groups/1/community_members",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "user@test.com",
        }),
      })
    );
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Group not found" }),
    });

    await expect(addMemberToGroup(999, "user@test.com")).rejects.toThrow();
  });
});
