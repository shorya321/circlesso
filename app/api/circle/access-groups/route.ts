import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getConfig } from "@/lib/config";
import { listAccessGroups } from "@/lib/circle-api";

// GET /api/circle/access-groups — list Circle.so access groups
export async function GET() {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
