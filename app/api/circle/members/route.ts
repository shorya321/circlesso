import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/admin-check";
import { getConfig } from "@/lib/config";
import { listMembers } from "@/lib/circle-api";
import {
  Auth0RateLimitError,
  getUserByEmail,
} from "@/lib/auth0-management";
import type {
  Auth0User,
  CircleMember,
  MemberWithStatus,
  ProvisioningStatus,
} from "@/types";

// Tuned for Auth0 Management API limits on dev/free tenants (~2 req/sec
// sustained with small burst). Fan-out of 2 workers × exponential backoff
// covers a full rate-limit window before falling to "failed".
const LOOKUP_CONCURRENCY = 2;
const LOOKUP_BACKOFF_MS = 500;
const MAX_LOOKUP_ATTEMPTS = 5;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function lookupWithRetry(email: string): Promise<Auth0User | null> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_LOOKUP_ATTEMPTS; attempt++) {
    try {
      return await getUserByEmail(email);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_LOOKUP_ATTEMPTS) {
        const jitter = Math.floor(Math.random() * 100);
        const backoff =
          error instanceof Auth0RateLimitError
            ? error.retryAfterMs + jitter
            : LOOKUP_BACKOFF_MS * Math.pow(2, attempt - 1) + jitter;
        await sleep(backoff);
      }
    }
  }
  throw lastError;
}

function buildStatus(
  member: CircleMember,
  auth0User: Auth0User | null
): MemberWithStatus {
  if (!auth0User) {
    return {
      circleMember: member,
      auth0Status: "not_provisioned",
      auth0UserId: null,
      errorMessage: null,
    };
  }

  const status: ProvisioningStatus =
    auth0User.app_metadata?.email_sent === true && auth0User.email_verified === true
      ? "password_changed"
      : auth0User.app_metadata?.email_sent === true
        ? "email_sent"
        : "auth0_created";

  return {
    circleMember: member,
    auth0Status: status,
    auth0UserId: auth0User.user_id,
    errorMessage: null,
  };
}

// GET /api/circle/members — list Circle.so members with Auth0 provisioning status
export async function GET() {
  const access = await checkAdminAccess();
  if (!access.isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!access.isAdmin) {
    return NextResponse.json(
      { error: "Forbidden: superadmin role required" },
      { status: 403 }
    );
  }

  try {
    const config = getConfig();
    const members = await listMembers(config.CIRCLE_COMMUNITY_ID);

    const membersWithStatus: MemberWithStatus[] = new Array(members.length);
    let cursor = 0;

    const worker = async (): Promise<void> => {
      while (true) {
        const index = cursor++;
        if (index >= members.length) return;
        const member = members[index];
        try {
          const auth0User = await lookupWithRetry(member.email);
          membersWithStatus[index] = buildStatus(member, auth0User);
        } catch {
          membersWithStatus[index] = {
            circleMember: member,
            auth0Status: "failed",
            auth0UserId: null,
            errorMessage: "Failed to check Auth0 status",
          };
        }
      }
    };

    const workerCount = Math.min(LOOKUP_CONCURRENCY, members.length);
    await Promise.all(
      Array.from({ length: workerCount }, () => worker())
    );

    return NextResponse.json(membersWithStatus);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch members";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
