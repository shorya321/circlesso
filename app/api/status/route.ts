import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/admin-check";
import { getConfig } from "@/lib/config";
import { listMembers } from "@/lib/circle-api";
import { getUserByEmail } from "@/lib/auth0-management";
import type { MemberWithStatus, ProvisioningStatus } from "@/types";

// GET /api/status — provisioning status for all Circle members
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
      error instanceof Error ? error.message : "Failed to fetch status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
