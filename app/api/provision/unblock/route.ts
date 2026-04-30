import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { checkAdminAccess } from "@/lib/admin-check";
import { unblockUser } from "@/lib/auth0-management";
import type { ProvisionResult } from "@/types";

// Auth0 user IDs follow `<connection>|<id>` format and only contain
// alphanumerics, `|`, `-`, `_`, `@`, and `.`. The regex provides
// defense-in-depth on top of encodeURIComponent in lib/auth0-management.
const unblockSchema = z.object({
  auth0UserId: z
    .string()
    .min(5)
    .max(128)
    .regex(/^[a-zA-Z0-9|_\-@.]+$/, "Invalid auth0UserId format"),
});

// POST /api/provision/unblock — unblock an Auth0 user (sets blocked: false).
// User can log in again. The next /api/circle/members refresh will recompute
// the row's status from app_metadata.email_sent / email_verified.
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

  let body: z.infer<typeof unblockSchema>;
  try {
    body = unblockSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  try {
    await unblockUser(body.auth0UserId);

    return NextResponse.json<ProvisionResult>({
      success: true,
      status: "email_sent",
      auth0UserId: body.auth0UserId,
    });
  } catch (error: unknown) {
    console.error("provision/unblock failed", error);
    return NextResponse.json<ProvisionResult>(
      {
        success: false,
        status: "failed",
        error: "Failed to unblock user",
      },
      { status: 500 }
    );
  }
}
