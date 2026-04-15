import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/admin-check";
import { getConfig } from "@/lib/config";
import { listAccessGroups } from "@/lib/circle-api";

// GET /api/circle/access-groups — list Circle.so access groups
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
    const groups = await listAccessGroups(config.CIRCLE_COMMUNITY_ID);
    return NextResponse.json(groups);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch access groups";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
