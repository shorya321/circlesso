// Circle.so Admin API v2 client
// TODO: Implement in F006

import { getConfig } from "./config";
import type {
  CircleMember,
  CircleAccessGroup,
  CirclePaginatedResponse,
} from "@/types";

const BASE_URL = "https://app.circle.so/api/admin/v2";

export async function listMembers(
  communityId: string
): Promise<CircleMember[]> {
  // TODO: Implement with pagination — GET /community_members
  throw new Error("Not implemented — F006");
}

export async function createMember(
  communityId: string,
  email: string,
  name: string
): Promise<CircleMember> {
  // TODO: Implement — POST /community_members
  throw new Error("Not implemented — F006");
}

export async function listAccessGroups(
  communityId: string
): Promise<CircleAccessGroup[]> {
  // TODO: Implement — GET /access_groups
  throw new Error("Not implemented — F006");
}

export async function addMemberToGroup(
  groupId: number,
  email: string
): Promise<void> {
  // TODO: Implement — POST /access_groups/{id}/members
  throw new Error("Not implemented — F006");
}
