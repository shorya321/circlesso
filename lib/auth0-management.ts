// Auth0 Management API client — M2M token + user CRUD
import { getConfig } from "./config";
import { generateRandomPassword } from "./utils";
import type { Auth0User, Auth0PasswordTicket, Auth0AppMetadata } from "@/types";

// M2M token cache
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

/** Reset token cache — exported for testing only */
export function _resetTokenCache(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
}

/**
 * Fetch an Auth0 Management API token via client_credentials grant.
 * Caches the token based on expires_in minus a 5-minute safety margin.
 */
export async function getManagementToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const config = getConfig();
  const response = await fetch(`https://${config.AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: config.AUTH0_M2M_CLIENT_ID,
      client_secret: config.AUTH0_M2M_CLIENT_SECRET,
      audience: `https://${config.AUTH0_DOMAIN}/api/v2/`,
    }),
  });

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
      body: JSON.stringify({
        email,
        connection: config.AUTH0_DB_CONNECTION,
        password: generateRandomPassword(),
        email_verified: false,
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

  return response.json();
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
