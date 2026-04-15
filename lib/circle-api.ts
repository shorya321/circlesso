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
      `${BASE_URL}/community_members?community_id=${communityId}&per_page=100&page=${page}&status=all`,
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
 *
 * Circle.so's POST /community_members response is wrapped as
 * `{ message, community_member: {...} }` — unlike the flat records returned
 * by GET /community_members. We unwrap so callers always get a CircleMember.
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

  const data: { community_member?: CircleMember } = await response.json();
  if (!data.community_member?.id) {
    throw new Error(
      "Circle.so createMember returned unexpected response shape (missing community_member.id)"
    );
  }
  return data.community_member;
}

/**
 * List all access groups for a community.
 */
export async function listAccessGroups(
  communityId: string
): Promise<CircleAccessGroup[]> {
  const response = await fetch(
    `${BASE_URL}/access_groups?community_id=${communityId}&per_page=100`,
    { method: "GET", headers: getHeaders() }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Circle.so listAccessGroups failed: ${error.error || response.status}`
    );
  }

  const data: CirclePaginatedResponse<CircleAccessGroup> = await response.json();
  return data.records;
}

/**
 * Add a member to an access group by email.
 */
export async function addMemberToGroup(
  groupId: number,
  email: string
): Promise<void> {
  const response = await fetch(
    `${BASE_URL}/access_groups/${groupId}/community_members`,
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
