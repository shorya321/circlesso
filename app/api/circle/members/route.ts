import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getConfig } from "@/lib/config";
import { listMembers } from "@/lib/circle-api";
import { getUserByEmail } from "@/lib/auth0-management";
import type { MemberWithStatus, ProvisioningStatus } from "@/types";

// GET /api/circle/members — list Circle.so members with Auth0 provisioning status
export async function GET() {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = getConfig();
    const members = await listMembers(config.CIRCLE_COMMUNITY_ID);

    const membersWithStatus: MemberWithStatus[] = await Promise.all(
      members.map(async (member) => {
        try {
          const auth0User = await getUserByEmail(member.email);

          if (!auth0User) {
            return {
              circleMember: member,
              auth0Status: "not_provisioned" as ProvisioningStatus,
              auth0UserId: null,
              errorMessage: null,
            };
          }

          const status: ProvisioningStatus =
            auth0User.app_metadata?.email_sent === true
              ? "email_sent"
              : "auth0_created";

          return {
            circleMember: member,
            auth0Status: status,
            auth0UserId: auth0User.user_id,
            errorMessage: null,
          };
        } catch {
          return {
            circleMember: member,
            auth0Status: "failed" as ProvisioningStatus,
            auth0UserId: null,
            errorMessage: "Failed to check Auth0 status",
          };
        }
      })
    );

    return NextResponse.json(membersWithStatus);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch members";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
