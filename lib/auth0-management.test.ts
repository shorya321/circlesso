import {
  getManagementToken,
  getUserByEmail,
  createUser,
  createPasswordTicket,
  updateUserMetadata,
  getUserRoles,
  blockUser,
  unblockUser,
  _resetTokenCache,
  Auth0RateLimitError,
} from "./auth0-management";

// Mock config
jest.mock("./config", () => ({
  getConfig: () => ({
    AUTH0_DOMAIN: "test.us.auth0.com",
    AUTH0_TENANT_DOMAIN: "test.us.auth0.com",
    AUTH0_M2M_CLIENT_ID: "test-client-id",
    AUTH0_M2M_CLIENT_SECRET: "test-client-secret",
    AUTH0_DB_CONNECTION: "Username-Password-Authentication",
    PASSWORD_TICKET_TTL: 604800,
    PASSWORD_TICKET_RESULT_URL: "https://compass.helpucompli.com",
  }),
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock generateRandomPassword
jest.mock("./utils", () => ({
  generateRandomPassword: () => "MockedRandomPassword123!@#abcdef",
}));

beforeEach(() => {
  mockFetch.mockReset();
  _resetTokenCache();
});

describe("getManagementToken", () => {
  it("fetches a new M2M token via client_credentials grant", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "test-access-token",
        expires_in: 86400,
        token_type: "Bearer",
      }),
    });

    const token = await getManagementToken();

    expect(token).toBe("test-access-token");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.us.auth0.com/oauth/token",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: "test-client-id",
          client_secret: "test-client-secret",
          audience: "https://test.us.auth0.com/api/v2/",
        }),
      })
    );
  });

  it("dedupes concurrent cold-start calls into a single /oauth/token fetch", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "deduped-token",
        expires_in: 86400,
      }),
    });

    const [a, b, c] = await Promise.all([
      getManagementToken(),
      getManagementToken(),
      getManagementToken(),
    ]);

    expect(a).toBe("deduped-token");
    expect(b).toBe("deduped-token");
    expect(c).toBe("deduped-token");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns cached token on subsequent calls within expiry", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "cached-token",
        expires_in: 86400,
      }),
    });

    const token1 = await getManagementToken();
    const token2 = await getManagementToken();

    expect(token1).toBe("cached-token");
    expect(token2).toBe("cached-token");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws on failed token fetch", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "access_denied" }),
    });

    await expect(getManagementToken()).rejects.toThrow(
      "Failed to fetch Auth0 M2M token"
    );
  });
});

describe("getUserByEmail", () => {
  beforeEach(() => {
    // Pre-populate token cache
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "mgmt-token", expires_in: 86400 }),
    });
  });

  it("returns user when found", async () => {
    const mockUser = {
      user_id: "auth0|123",
      email: "test@example.com",
      name: "Test User",
      email_verified: true,
      created_at: "2026-01-01T00:00:00.000Z",
      app_metadata: { source: "admin_provisioning" },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [mockUser],
    });

    const result = await getUserByEmail("test@example.com");

    expect(result).toEqual(mockUser);
    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://test.us.auth0.com/api/v2/users-by-email?email=test%40example.com",
      expect.objectContaining({
        method: "GET",
        headers: {
          Authorization: "Bearer mgmt-token",
          "Content-Type": "application/json",
        },
      })
    );
  });

  it("returns null when user not found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const result = await getUserByEmail("nonexistent@example.com");
    expect(result).toBeNull();
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: "Internal error" }),
    });

    await expect(getUserByEmail("test@example.com")).rejects.toThrow();
  });

  it("throws Auth0RateLimitError with retryAfterMs parsed from Retry-After header on 429", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "retry-after" ? "3" : null,
      },
      json: async () => ({ message: "Rate limit exceeded" }),
    });

    let thrown: unknown;
    try {
      await getUserByEmail("test@example.com");
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(Auth0RateLimitError);
    expect((thrown as Auth0RateLimitError).retryAfterMs).toBe(3000);
    expect((thrown as Auth0RateLimitError).name).toBe("Auth0RateLimitError");
  });

  it("throws Auth0RateLimitError with default 2000ms retryAfterMs when Retry-After header is absent", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: { get: () => null },
      json: async () => ({ message: "Rate limit exceeded" }),
    });

    await expect(
      getUserByEmail("test@example.com")
    ).rejects.toMatchObject({
      name: "Auth0RateLimitError",
      retryAfterMs: 2000,
    });
  });

  it("throws Auth0RateLimitError with default 2000ms retryAfterMs when Retry-After is non-numeric", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "retry-after" ? "not-a-number" : null,
      },
      json: async () => ({ message: "Rate limit exceeded" }),
    });

    await expect(
      getUserByEmail("test@example.com")
    ).rejects.toMatchObject({
      name: "Auth0RateLimitError",
      retryAfterMs: 2000,
    });
  });
});

describe("createUser", () => {
  beforeEach(() => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "mgmt-token", expires_in: 86400 }),
    });
  });

  it("creates a user with random password and metadata", async () => {
    const mockUser = {
      user_id: "auth0|456",
      email: "new@example.com",
      name: "New User",
      email_verified: false,
      created_at: "2026-04-14T00:00:00.000Z",
      app_metadata: {
        source: "admin_provisioning",
        circle_member_id: "789",
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
    });

    const result = await createUser("new@example.com", "New User", {
      source: "admin_provisioning",
      circle_member_id: "789",
    });

    expect(result).toEqual(mockUser);
    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://test.us.auth0.com/api/v2/users",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "new@example.com",
          connection: "Username-Password-Authentication",
          password: "MockedRandomPassword123!@#abcdef",
          email_verified: false,
          verify_email: false,
          name: "New User",
          app_metadata: {
            source: "admin_provisioning",
            circle_member_id: "789",
          },
        }),
      })
    );
  });

  it("sends verify_email: false to suppress Auth0's automatic verification email", async () => {
    const mockUser = {
      user_id: "auth0|suppress",
      email: "quiet@example.com",
      name: "Quiet User",
      email_verified: false,
      created_at: "2026-04-15T00:00:00.000Z",
      app_metadata: { source: "admin_provisioning" },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
    });

    await createUser("quiet@example.com", "Quiet User", {
      source: "admin_provisioning",
    });

    const [, options] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const sentBody = JSON.parse(options.body);
    expect(sentBody.verify_email).toBe(false);
    expect(sentBody.email_verified).toBe(false);
  });

  it("throws on 409 conflict with descriptive message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ message: "The user already exists." }),
    });

    await expect(
      createUser("existing@example.com", "Existing", {
        source: "admin_provisioning",
      })
    ).rejects.toThrow("User already exists");
  });

  it("throws on other API errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: "Bad request" }),
    });

    await expect(
      createUser("bad@example.com", "Bad", { source: "admin_provisioning" })
    ).rejects.toThrow();
  });
});

describe("createPasswordTicket", () => {
  beforeEach(() => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "mgmt-token", expires_in: 86400 }),
    });
  });

  it("creates a password change ticket", async () => {
    const mockTicket = {
      ticket: "https://test.us.auth0.com/lo/reset?ticket=abc123",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTicket,
    });

    const result = await createPasswordTicket(
      "auth0|123",
      "https://compass.helpucompli.com",
      604800
    );

    expect(result).toEqual(mockTicket);
    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://test.us.auth0.com/api/v2/tickets/password-change",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          user_id: "auth0|123",
          result_url: "https://compass.helpucompli.com",
          mark_email_as_verified: true,
          ttl_sec: 604800,
        }),
      })
    );
  });

  it("rewrites the ticket host to AUTH0_DOMAIN when Auth0 returns the raw tenant host", async () => {
    // Auth0 returns tickets pointing at the raw tenant domain
    // (e.g. dev-xxx.us.auth0.com) even when the Management API is called
    // against a custom domain. The helper must rewrite the host so the
    // welcome email shows the branded custom domain (AUTH0_DOMAIN in this
    // mock is "test.us.auth0.com").
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ticket:
          "https://dev-nm78h40g55lhbjx8.us.auth0.com/lo/reset?ticket=abc123",
      }),
    });

    const result = await createPasswordTicket(
      "auth0|456",
      "https://compass.helpucompli.com",
      604800
    );

    expect(result.ticket).toBe(
      "https://test.us.auth0.com/lo/reset?ticket=abc123"
    );
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: "User not found" }),
    });

    await expect(
      createPasswordTicket("auth0|invalid", "https://example.com", 604800)
    ).rejects.toThrow();
  });
});

describe("updateUserMetadata", () => {
  beforeEach(() => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "mgmt-token", expires_in: 86400 }),
    });
  });

  it("updates user app_metadata", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await updateUserMetadata("auth0|123", {
      email_sent: true,
      email_sent_at: "2026-04-14T12:00:00.000Z",
    });

    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://test.us.auth0.com/api/v2/users/auth0%7C123",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          app_metadata: {
            email_sent: true,
            email_sent_at: "2026-04-14T12:00:00.000Z",
          },
        }),
      })
    );
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: "User not found" }),
    });

    await expect(
      updateUserMetadata("auth0|invalid", { email_sent: true })
    ).rejects.toThrow();
  });
});

describe("blockUser", () => {
  beforeEach(() => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "mgmt-token", expires_in: 86400 }),
    });
  });

  it("PATCHes user with blocked: true", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await blockUser("auth0|123");

    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://test.us.auth0.com/api/v2/users/auth0%7C123",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          Authorization: "Bearer mgmt-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ blocked: true }),
      })
    );
  });

  it("URL-encodes the user id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await blockUser("auth0|complex+id@test");

    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://test.us.auth0.com/api/v2/users/auth0%7Ccomplex%2Bid%40test",
      expect.any(Object)
    );
  });

  it("throws Auth0RateLimitError on 429 with parsed Retry-After", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "retry-after" ? "5" : null,
      },
      json: async () => ({ message: "Rate limit" }),
    });

    let thrown: unknown;
    try {
      await blockUser("auth0|123");
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(Auth0RateLimitError);
    expect((thrown as Auth0RateLimitError).retryAfterMs).toBe(5000);
  });

  it("throws on non-2xx API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: "User not found" }),
    });

    await expect(blockUser("auth0|missing")).rejects.toThrow(
      /blockUser failed/
    );
  });
});

describe("unblockUser", () => {
  beforeEach(() => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "mgmt-token", expires_in: 86400 }),
    });
  });

  it("PATCHes user with blocked: false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await unblockUser("auth0|123");

    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://test.us.auth0.com/api/v2/users/auth0%7C123",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ blocked: false }),
      })
    );
  });

  it("throws Auth0RateLimitError on 429", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: { get: () => null },
      json: async () => ({ message: "Rate limit" }),
    });

    await expect(unblockUser("auth0|123")).rejects.toMatchObject({
      name: "Auth0RateLimitError",
      retryAfterMs: 2000,
    });
  });

  it("throws on non-2xx API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: "Internal error" }),
    });

    await expect(unblockUser("auth0|123")).rejects.toThrow(
      /unblockUser failed/
    );
  });
});

describe("getUserRoles", () => {
  beforeEach(() => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "mgmt-token", expires_in: 86400 }),
    });
  });

  it("returns user roles array on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: "rol_abc123", name: "admin", description: "Admin role" },
        { id: "rol_def456", name: "user" },
      ],
    });

    const roles = await getUserRoles("auth0|user-1");

    expect(roles).toHaveLength(2);
    expect(roles[0].name).toBe("admin");
    expect(roles[1].name).toBe("user");
    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://test.us.auth0.com/api/v2/users/auth0%7Cuser-1/roles",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer mgmt-token",
        }),
      })
    );
  });

  it("returns empty array when user has no roles", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const roles = await getUserRoles("auth0|user-2");
    expect(roles).toEqual([]);
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ message: "Insufficient scope: read:roles" }),
    });

    await expect(getUserRoles("auth0|user-3")).rejects.toThrow(
      /getUserRoles failed/
    );
  });

  it("URL-encodes the user id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    await getUserRoles("auth0|complex+id@test");

    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://test.us.auth0.com/api/v2/users/auth0%7Ccomplex%2Bid%40test/roles",
      expect.any(Object)
    );
  });
});
