// Admin role check — combines Auth0 session with Management API role lookup.
// Returns auth state + admin flag. Caches per user for 5 minutes to avoid
// hammering the Management API on every request.

import { auth0 } from "./auth0";
import { getUserRoles } from "./auth0-management";
import { getConfig } from "./config";

export interface AdminCheckResult {
  isAuthenticated: boolean;
  isAdmin: boolean;
  userId: string | null;
  email: string | null;
}

interface CachedAdmin {
  isAdmin: boolean;
  expiresAt: number;
}

const adminCache = new Map<string, CachedAdmin>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Reset cache — exported for testing only. */
export function _resetAdminCache(): void {
  adminCache.clear();
}

/**
 * Check whether the current Auth0 session belongs to a user with the admin role.
 * Returns auth state + admin flag. Does not throw or send responses — caller decides.
 *
 * Behavior:
 * - No session → isAuthenticated: false
 * - Session but role fetch fails → fail closed (isAdmin: false), do not cache
 * - Session + role found → cache result for 5 minutes
 */
export async function checkAdminAccess(): Promise<AdminCheckResult> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return {
      isAuthenticated: false,
      isAdmin: false,
      userId: null,
      email: null,
    };
  }

  const userId = session.user.sub;
  const email = session.user.email ?? null;

  const cached = adminCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) {
    return { isAuthenticated: true, isAdmin: cached.isAdmin, userId, email };
  }

  let isAdmin = false;
  try {
    const config = getConfig();
    const roles = await getUserRoles(userId);
    isAdmin = roles.some((r) => r.name === config.ADMIN_ROLE_NAME);
  } catch {
    return { isAuthenticated: true, isAdmin: false, userId, email };
  }

  adminCache.set(userId, { isAdmin, expiresAt: Date.now() + CACHE_TTL_MS });
  return { isAuthenticated: true, isAdmin, userId, email };
}
