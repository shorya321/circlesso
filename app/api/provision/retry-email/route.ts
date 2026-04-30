import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { checkAdminAccess } from "@/lib/admin-check";
import { getConfig } from "@/lib/config";
import {
  createPasswordTicket,
  updateUserMetadata,
} from "@/lib/auth0-management";
import { sendWelcomeEmail } from "@/lib/resend-email";
import type { ProvisionResult } from "@/types";

// Auth0 user IDs follow `<connection>|<id>` and only contain alphanumerics,
// `|`, `-`, `_`, `@`, and `.`. Regex provides defense-in-depth on top of
// encodeURIComponent in lib/auth0-management.
const retryEmailSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  auth0UserId: z
    .string()
    .min(5)
    .max(128)
    .regex(/^[a-zA-Z0-9|_\-@.]+$/, "Invalid auth0UserId format"),
});

// POST /api/provision/retry-email — resend welcome email for an existing Auth0 user.
// Generates a fresh password-change ticket, sends the welcome email, and marks
// app_metadata.email_sent = true. Used by the Retry Email button for members
// stuck in "auth0_created" (Auth0 user exists but email never sent).
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

  let body: z.infer<typeof retryEmailSchema>;
  try {
    body = retryEmailSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  try {
    const config = getConfig();

    const ticket = await createPasswordTicket(
      body.auth0UserId,
      config.PASSWORD_TICKET_RESULT_URL,
      config.PASSWORD_TICKET_TTL
    );

    try {
      await sendWelcomeEmail(body.email, body.name, ticket.ticket);
    } catch (emailError: unknown) {
      // Best-effort: mark email_sent=false so the badge reflects reality.
      // Ignore secondary failures here — surfacing the primary email error is
      // more useful than a cascading metadata write error.
      try {
        await updateUserMetadata(body.auth0UserId, { email_sent: false });
      } catch {
        // swallowed — metadata rollback is best-effort
      }
      const message =
        emailError instanceof Error
          ? emailError.message
          : "Welcome email failed";
      return NextResponse.json<ProvisionResult>(
        {
          success: false,
          status: "auth0_created",
          auth0UserId: body.auth0UserId,
          emailSent: false,
          error: `Welcome email failed: ${message}`,
        },
        { status: 500 }
      );
    }

    await updateUserMetadata(body.auth0UserId, {
      email_sent: true,
      email_sent_at: new Date().toISOString(),
    });

    return NextResponse.json<ProvisionResult>({
      success: true,
      status: "email_sent",
      auth0UserId: body.auth0UserId,
      emailSent: true,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Retry email failed";
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
