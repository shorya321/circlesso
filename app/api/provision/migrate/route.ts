import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { checkAdminAccess } from "@/lib/admin-check";
import { getConfig } from "@/lib/config";
import {
  getUserByEmail,
  createUser,
  createPasswordTicket,
  updateUserMetadata,
} from "@/lib/auth0-management";
import { sendWelcomeEmail } from "@/lib/resend-email";
import type { ProvisionResult } from "@/types";

const migrateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  circleMemberId: z.string(),
});

// POST /api/provision/migrate — migrate existing Circle.so member to Auth0
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

  let body: z.infer<typeof migrateSchema>;
  try {
    body = migrateSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  try {
    const config = getConfig();

    // Step 1: Check if user already exists in Auth0
    const existingUser = await getUserByEmail(body.email);
    if (existingUser) {
      return NextResponse.json<ProvisionResult>({
        success: true,
        status: "email_sent",
        auth0UserId: existingUser.user_id,
        emailSent: existingUser.app_metadata?.email_sent === true,
      });
    }

    // Step 2: Create Auth0 user
    const auth0User = await createUser(body.email, body.name, {
      source: "admin_provisioning",
      circle_member_id: body.circleMemberId,
    });

    // Step 3: Generate password-change ticket
    const ticket = await createPasswordTicket(
      auth0User.user_id,
      config.PASSWORD_TICKET_RESULT_URL,
      config.PASSWORD_TICKET_TTL
    );

    // Step 4: Send welcome email
    try {
      await sendWelcomeEmail(body.email, body.name, ticket.ticket);
      // Step 5: Update metadata to mark email as sent
      await updateUserMetadata(auth0User.user_id, {
        email_sent: true,
        email_sent_at: new Date().toISOString(),
      });

      return NextResponse.json<ProvisionResult>({
        success: true,
        status: "email_sent",
        auth0UserId: auth0User.user_id,
        emailSent: true,
      });
    } catch {
      // Email failed — mark as auth0_created so admin can retry
      await updateUserMetadata(auth0User.user_id, {
        email_sent: false,
      });

      return NextResponse.json<ProvisionResult>({
        success: true,
        status: "auth0_created",
        auth0UserId: auth0User.user_id,
        emailSent: false,
        error: "Auth0 account created but welcome email failed. Use Retry Email.",
      });
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Migration failed";
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
