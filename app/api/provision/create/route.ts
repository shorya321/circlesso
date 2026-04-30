import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { checkAdminAccess } from "@/lib/admin-check";
import { getConfig } from "@/lib/config";
import { createMember, addMemberToGroup } from "@/lib/circle-api";
import {
  createUser,
  createPasswordTicket,
  updateUserMetadata,
  getUserByEmail,
} from "@/lib/auth0-management";
import { sendWelcomeEmail } from "@/lib/resend-email";
import { redactEmail } from "@/lib/utils";
import type { ProvisionResult } from "@/types";

const createMemberSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  accessGroupIds: z.array(z.number().int().positive()).min(1),
});

// POST /api/provision/create — create new member in Circle.so + Auth0
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

    // Step 2: Add to access groups — non-fatal. Per design spec, a failure here
    // is a warning; Auth0 provisioning still continues so the user gets an account.
    // Circle.so API has no bulk endpoint — loop sequentially to stay inside rate limits.
    const failedGroupIds: number[] = [];
    for (const groupId of body.accessGroupIds) {
      try {
        await addMemberToGroup(groupId, body.email);
      } catch (error: unknown) {
        failedGroupIds.push(groupId);
        console.error("addMemberToGroup failed", {
          email: redactEmail(body.email),
          accessGroupId: groupId,
          error: error instanceof Error ? error.message : error,
        });
      }
    }
    const accessGroupAssigned = failedGroupIds.length === 0;
    if (!accessGroupAssigned) {
      // IDs are internal — log server-side only, keep user message generic.
      console.error("addMemberToGroup partial failure", {
        email: redactEmail(body.email),
        failedGroupIds,
      });
    }
    const accessGroupWarning = accessGroupAssigned
      ? undefined
      : `Member created but NOT added to ${failedGroupIds.length} access group(s). Assign manually in Circle dashboard.`;

    // Step 3: Create Auth0 user — or reuse existing one on 409.
    // Scenario: Auth0 account existed before this admin-driven Circle.so
    // creation (e.g. user was invited elsewhere). We still want the welcome
    // email + password-change ticket to go out to that existing account.
    let auth0User;
    let auth0AlreadyExisted = false;
    try {
      auth0User = await createUser(body.email, fullName, {
        source: "admin_provisioning",
        circle_member_id: String(circleMember.id),
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Auth0 creation failed";
      const isAlreadyExists = message === "User already exists";

      if (isAlreadyExists) {
        try {
          const existing = await getUserByEmail(body.email);
          if (!existing) {
            // Conflict from Auth0 but lookup returned nothing — treat as error.
            return NextResponse.json<ProvisionResult>(
              {
                success: false,
                status: "failed",
                accessGroupAssigned,
                error:
                  "Auth0 reported user already exists but lookup returned no user. Try again or check Auth0 dashboard.",
              },
              { status: 500 }
            );
          }
          auth0User = existing;
          auth0AlreadyExisted = true;
          // Best-effort: link existing Auth0 user to the newly created
          // Circle member via app_metadata. Non-fatal on failure.
          try {
            await updateUserMetadata(existing.user_id, {
              source: "admin_provisioning",
              circle_member_id: String(circleMember.id),
            });
          } catch (metaError: unknown) {
            console.error("updateUserMetadata (link existing) failed", {
              email: redactEmail(body.email),
              auth0UserId: existing.user_id,
              error:
                metaError instanceof Error
                  ? metaError.message
                  : metaError,
            });
          }
        } catch (lookupError: unknown) {
          const lookupMessage =
            lookupError instanceof Error
              ? lookupError.message
              : "Auth0 lookup failed";
          return NextResponse.json<ProvisionResult>(
            {
              success: false,
              status: "failed",
              accessGroupAssigned,
              error: `Created in Circle.so but Auth0 lookup failed: ${lookupMessage}`,
            },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json<ProvisionResult>(
          {
            success: false,
            status: "failed",
            accessGroupAssigned,
            error: `Created in Circle.so but Auth0 failed: ${message}`,
          },
          { status: 500 }
        );
      }
    }

    const auth0ExistedWarning = auth0AlreadyExisted
      ? "Auth0 account already existed for this email — sent password-reset/welcome email to the existing account."
      : undefined;
    const combinedWarning = [accessGroupWarning, auth0ExistedWarning]
      .filter(Boolean)
      .join(" ");

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
        accessGroupAssigned,
        warning: combinedWarning || undefined,
      });
    } catch (error: unknown) {
      const emailErrorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("sendWelcomeEmail failed", {
        email: redactEmail(body.email),
        auth0UserId: auth0User.user_id,
        from: config.EMAIL_FROM,
        error: emailErrorMessage,
      });
      try {
        await updateUserMetadata(auth0User.user_id, {
          email_sent: false,
        });
      } catch {
        // swallowed — metadata rollback is best-effort, primary error is the Resend failure
      }

      return NextResponse.json<ProvisionResult>({
        success: true,
        status: "auth0_created",
        auth0UserId: auth0User.user_id,
        emailSent: false,
        accessGroupAssigned,
        warning: combinedWarning || undefined,
        error: `Welcome email failed: ${emailErrorMessage}. Use Retry Email.`,
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
