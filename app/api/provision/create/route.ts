import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { auth0 } from "@/lib/auth0";
import { getConfig } from "@/lib/config";
import { createMember, addMemberToGroup } from "@/lib/circle-api";
import {
  createUser,
  createPasswordTicket,
  updateUserMetadata,
} from "@/lib/auth0-management";
import { sendWelcomeEmail } from "@/lib/resend-email";
import type { ProvisionResult } from "@/types";

const createMemberSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  accessGroupId: z.number().int().positive(),
});

// POST /api/provision/create — create new member in Circle.so + Auth0
export async function POST(request: NextRequest) {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof createMemberSchema>;
  try {
    body = createMemberSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const fullName = `${body.firstName} ${body.lastName}`;
  const config = getConfig();

  try {
    // Step 1: Create member in Circle.so
    const circleMember = await createMember(
      config.CIRCLE_COMMUNITY_ID,
      body.email,
      fullName
    );

    // Step 2: Add to access group
    try {
      await addMemberToGroup(body.accessGroupId, body.email);
    } catch {
      return NextResponse.json<ProvisionResult>({
        success: true,
        status: "failed",
        error:
          "Member created in Circle.so but access group assignment failed. Assign manually in Circle dashboard.",
      });
    }

    // Step 3: Create Auth0 user
    let auth0User;
    try {
      auth0User = await createUser(body.email, fullName, {
        source: "admin_provisioning",
        circle_member_id: String(circleMember.id),
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Auth0 creation failed";
      return NextResponse.json<ProvisionResult>(
        {
          success: false,
          status: "failed",
          error: `Created in Circle.so but Auth0 failed: ${message}`,
        },
        { status: 500 }
      );
    }

    // Step 4: Generate password-change ticket
    const ticket = await createPasswordTicket(
      auth0User.user_id,
      config.PASSWORD_TICKET_RESULT_URL,
      config.PASSWORD_TICKET_TTL
    );

    // Step 5: Send welcome email
    try {
      await sendWelcomeEmail(body.email, fullName, ticket.ticket);
      // Step 6: Update metadata
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
      await updateUserMetadata(auth0User.user_id, {
        email_sent: false,
      });

      return NextResponse.json<ProvisionResult>({
        success: true,
        status: "auth0_created",
        auth0UserId: auth0User.user_id,
        emailSent: false,
        error:
          "Member created and Auth0 account set up, but welcome email failed. Use Retry Email.",
      });
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Creation failed";
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
