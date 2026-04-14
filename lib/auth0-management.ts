// Auth0 Management API client — M2M token + user CRUD
// TODO: Implement in F005

import { getConfig } from "./config";
import type { Auth0User, Auth0PasswordTicket, Auth0AppMetadata } from "@/types";

// M2M token cache
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

export async function getManagementToken(): Promise<string> {
  // TODO: Implement M2M token fetch with cache
  throw new Error("Not implemented — F005");
}

export async function getUserByEmail(
  email: string
): Promise<Auth0User | null> {
  // TODO: Implement — GET /api/v2/users-by-email
  throw new Error("Not implemented — F005");
}

export async function createUser(
  email: string,
  name: string,
  metadata: Auth0AppMetadata
): Promise<Auth0User> {
  // TODO: Implement — POST /api/v2/users
  throw new Error("Not implemented — F005");
}

export async function createPasswordTicket(
  userId: string,
  resultUrl: string,
  ttlSec: number
): Promise<Auth0PasswordTicket> {
  // TODO: Implement — POST /api/v2/tickets/password-change
  throw new Error("Not implemented — F005");
}

export async function updateUserMetadata(
  userId: string,
  metadata: Partial<Auth0AppMetadata>
): Promise<void> {
  // TODO: Implement — PATCH /api/v2/users/{id}
  throw new Error("Not implemented — F005");
}
