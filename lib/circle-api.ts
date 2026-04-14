// Circle.so Admin API v2 client
import { getConfig } from "./config";
import type {
  CircleMember,
  CircleAccessGroup,
  CirclePaginatedResponse,
} from "@/types";

const BASE_URL = "https://app.circle.so/api/admin/v2";

function getHeaders(): Record<string, string> {
  const config = getConfig();
  return {
    Authorization: `Bearer ${config.CIRCLE_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

/**
 * List all community members with automatic pagination.
 * Fetches pages of 100 until has_next_page is false.
 */
export async function listMembers(
  communityId: string
): Promise<CircleMember[]> {
  const allMembers: CircleMember[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await fetch(
      `${BASE_URL}/community_members?community_id=${communityId}&per_page=100&page=${page}`,
      { method: "GET", headers: getHeaders() }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Circle.so listMembers failed: ${error.error || response.status}`
      );
    }

    const data: CirclePaginatedResponse<CircleMember> = await response.json();
    allMembers.push(...data.records);
    hasNextPage = data.has_next_page;
    page += 1;
  }

  return allMembers;
}

/**
 * Create a new community member.
 */
export async function createMember(
  communityId: string,
  email: string,
  name: string
): Promise<CircleMember> {
  const response = await fetch(`${BASE_URL}/community_members`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      community_id: communityId,
      email,
      name,
      skip_invitation: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Circle.so createMember failed: ${error.error || response.status}`
    );
  }

  return response.json();
}

/**
 * List all access groups for a community.
 */
export async function listAccessGroups(
  communityId: string
): Promise<CircleAccessGroup[]> {
  const response = await fetch(
    `${BASE_URL}/access_groups?community_id=${communityId}`,
    { method: "GET", headers: getHeaders() }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Circle.so listAccessGroups failed: ${error.error || response.status}`
    );
  }

  return response.json();
}

/**
 * Add a member to an access group by email.
 */
export async function addMemberToGroup(
  groupId: number,
  email: string
): Promise<void> {
  const response = await fetch(
    `${BASE_URL}/access_groups/${groupId}/members`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ email }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Circle.so addMemberToGroup failed: ${error.error || response.status}`
    );
  }
}
