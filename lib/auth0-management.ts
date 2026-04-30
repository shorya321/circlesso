// Auth0 Management API client — M2M token + user CRUD
import { getConfig } from "./config";
import { generateRandomPassword } from "./utils";
import type {
  Auth0User,
  Auth0PasswordTicket,
  Auth0AppMetadata,
  Auth0Role,
} from "@/types";

/**
 * Thrown when Auth0 Management API returns HTTP 429.
 * `retryAfterMs` is parsed from the `Retry-After` response header (seconds,
 * per RFC 6585) and falls back to 2000ms when the header is absent or invalid.
 * Callers that retry Auth0 requests should honor this value instead of
 * applying a generic exponential backoff.
 */
export class Auth0RateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number, message: string) {
    super(message);
    this.name = "Auth0RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

const DEFAULT_RETRY_AFTER_MS = 2000;

function parseRetryAfterMs(headerValue: string | null): number {
  if (!headerValue) return DEFAULT_RETRY_AFTER_MS;
  const seconds = Number.parseInt(headerValue, 10);
  if (!Number.isFinite(seconds) || seconds < 0) return DEFAULT_RETRY_AFTER_MS;
  return seconds * 1000;
}

// M2M token cache
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;
// In-flight fetch promise for de-duping concurrent cold-start callers.
// When N requests arrive simultaneously with no cached token, only one
// /oauth/token fetch occurs; the rest await this promise.
let tokenInFlight: Promise<string> | null = null;

/** Reset token cache — exported for testing only */
export function _resetTokenCache(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
  tokenInFlight = null;
}

/**
 * Fetch an Auth0 Management API token via client_credentials grant.
 * Caches the token based on expires_in minus a 5-minute safety margin.
 * Concurrent callers share a single in-flight request.
 */
export async function getManagementToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }
  if (tokenInFlight) {
    return tokenInFlight;
  }

  tokenInFlight = (async () => {
    try {
      const config = getConfig();
      const response = await fetch(
        `https://${config.AUTH0_DOMAIN}/oauth/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "client_credentials",
            client_id: config.AUTH0_M2M_CLIENT_ID,
            client_secret: config.AUTH0_M2M_CLIENT_SECRET,
            audience: `https://${config.AUTH0_TENANT_DOMAIN}/api/v2/`,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch Auth0 M2M token: ${response.status}`
        );
      }

      const data = await response.json();
      cachedToken = data.access_token;
      // Cache with 5-minute safety margin
      tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
      return cachedToken!;
    } finally {
      tokenInFlight = null;
    }
  })();

  return tokenInFlight;
}

/**
 * Look up an Auth0 user by email.
 * Returns null if no user is found.
 */
export async function getUserByEmail(
  email: string
): Promise<Auth0User | null> {
  const config = getConfig();
  const token = await getManagementToken();

  const response = await fetch(
    `https://${config.AUTH0_DOMAIN}/api/v2/users-by-email?email=${encodeURIComponent(email)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfterMs = parseRetryAfterMs(
        response.headers.get("retry-after")
      );
      throw new Auth0RateLimitError(
        retryAfterMs,
        `Auth0 getUserByEmail rate-limited (429); retry after ${retryAfterMs}ms`
      );
    }
    const error = await response.json();
    throw new Error(
      `Auth0 getUserByEmail failed: ${error.message || response.status}`
    );
  }

  const users: Auth0User[] = await response.json();
  return users.length > 0 ? users[0] : null;
}

/**
 * Create a new Auth0 user with a random password and app_metadata.
 * Throws a descriptive error on 409 (user already exists).
 */
export async function createUser(
  email: string,
  name: string,
  metadata: Auth0AppMetadata
): Promise<Auth0User> {
  const config = getConfig();
  const token = await getManagementToken();

  const response = await fetch(
    `https://${config.AUTH0_DOMAIN}/api/v2/users`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      // verify_email: false overrides the connection-level "Send Verification
      // Email" default so Auth0 does NOT send its own verification email at
      // creation. The user will get exactly one email — our branded welcome
      // email from Resend — and the address is verified when they click the
      // password-change ticket (mark_email_as_verified: true).
      body: JSON.stringify({
        email,
        connection: config.AUTH0_DB_CONNECTION,
        password: generateRandomPassword(),
        email_verified: false,
        verify_email: false,
        name,
        app_metadata: metadata,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 409) {
      throw new Error("User already exists");
    }
    throw new Error(
      `Auth0 createUser failed: ${error.message || response.status}`
    );
  }

  return response.json();
}

/**
 * Generate a password-change ticket for the given user.
 * Sets mark_email_as_verified: true so the user's email is verified
 * when they click the link.
 *
 * Auth0 returns the ticket URL with the raw tenant domain (e.g.
 * `dev-xxx.us.auth0.com`) even when the Management API is called
 * against a custom domain. We rewrite the host to `AUTH0_DOMAIN` so the
 * link in the welcome email shows the branded custom domain.
 */
export async function createPasswordTicket(
  userId: string,
  resultUrl: string,
  ttlSec: number
): Promise<Auth0PasswordTicket> {
  const config = getConfig();
  const token = await getManagementToken();

  const response = await fetch(
    `https://${config.AUTH0_DOMAIN}/api/v2/tickets/password-change`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        result_url: resultUrl,
        mark_email_as_verified: true,
        ttl_sec: ttlSec,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Auth0 createPasswordTicket failed: ${error.message || response.status}`
    );
  }

  const data: Auth0PasswordTicket = await response.json();

  try {
    const ticketUrl = new URL(data.ticket);
    ticketUrl.host = config.AUTH0_DOMAIN;
    return { ticket: ticketUrl.toString() };
  } catch {
    return data;
  }
}

/**
 * Update a user's app_metadata.
 * Used to track email_sent status after provisioning.
 */
export async function updateUserMetadata(
  userId: string,
  metadata: Partial<Auth0AppMetadata>
): Promise<void> {
  const config = getConfig();
  const token = await getManagementToken();

  const response = await fetch(
    `https://${config.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_metadata: metadata,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Auth0 updateUserMetadata failed: ${error.message || response.status}`
    );
  }
}

/**
 * Block an Auth0 user (sets `blocked: true`).
 * The user can no longer log in until unblocked.
 */
export async function blockUser(userId: string): Promise<void> {
  await setUserBlocked(userId, true);
}

/**
 * Unblock an Auth0 user (sets `blocked: false`).
 */
export async function unblockUser(userId: string): Promise<void> {
  await setUserBlocked(userId, false);
}

async function setUserBlocked(
  userId: string,
  blocked: boolean
): Promise<void> {
  const config = getConfig();
  const token = await getManagementToken();
  const action = blocked ? "blockUser" : "unblockUser";

  const response = await fetch(
    `https://${config.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ blocked }),
    }
  );

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfterMs = parseRetryAfterMs(
        response.headers.get("retry-after")
      );
      throw new Auth0RateLimitError(
        retryAfterMs,
        `Auth0 ${action} rate-limited (429); retry after ${retryAfterMs}ms`
      );
    }
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Auth0 ${action} failed: ${error.message || response.status}`
    );
  }
}

/**
 * Fetch the roles assigned to an Auth0 user.
 * Requires the M2M app to have read:roles and read:role_members scopes.
 */
export async function getUserRoles(userId: string): Promise<Auth0Role[]> {
  const config = getConfig();
  const token = await getManagementToken();

  const response = await fetch(
    `https://${config.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}/roles`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Auth0 getUserRoles failed: ${error.message || response.status}`
    );
  }

  return response.json();
}
