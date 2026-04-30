import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { checkAdminAccess } from "@/lib/admin-check";
import { blockUser } from "@/lib/auth0-management";
import type { ProvisionResult } from "@/types";

const blockSchema = z.object({
  auth0UserId: z.string().min(1),
});

// POST /api/provision/block — block an Auth0 user (sets blocked: true).
// User is unable to log in until unblocked.
export async function POST(request: NextRequest) {
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

  let body: z.infer<typeof blockSchema>;
  try {
    body = blockSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  try {
    await blockUser(body.auth0UserId);

    return NextResponse.json<ProvisionResult>({
      success: true,
      status: "blocked",
      auth0UserId: body.auth0UserId,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Block user failed";
    return NextResponse.json<ProvisionResult>(
      {
        success: false,
        status: "failed",
        error: message,
      },
      { status: 500 }
    );
  }
}
