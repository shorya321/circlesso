// Client-side helpers for member provisioning actions.
// Each helper POSTs to its API route and returns ProvisionResult.
// Toast/UI state stays in components.

import type { ProvisionResult } from "@/types";

interface MigrateInput {
  email: string;
  name: string;
  circleMemberId: string;
}

interface RetryEmailInput {
  email: string;
  name: string;
  auth0UserId: string;
}

interface BlockInput {
  auth0UserId: string;
}

// 15s cap on stalled requests (typical Auth0 PATCH is sub-second).
const REQUEST_TIMEOUT_MS = 15_000;

async function postJson(
  url: string,
  body: unknown
): Promise<ProvisionResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const data = (await response.json()) as ProvisionResult;
  if (!response.ok && data.success === undefined) {
    return {
      success: false,
      status: "failed",
      error: data.error ?? `Request failed (${response.status})`,
    };
  }
  return data;
}

export function provisionMigrate(
  input: MigrateInput
): Promise<ProvisionResult> {
  return postJson("/api/provision/migrate", input);
}

export function provisionRetryEmail(
  input: RetryEmailInput
): Promise<ProvisionResult> {
  return postJson("/api/provision/retry-email", input);
}

export function provisionBlock(input: BlockInput): Promise<ProvisionResult> {
  return postJson("/api/provision/block", input);
}

export function provisionUnblock(
  input: BlockInput
): Promise<ProvisionResult> {
  return postJson("/api/provision/unblock", input);
}
