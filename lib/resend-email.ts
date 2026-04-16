// Resend email client
import { Resend } from "resend";
import { getConfig } from "./config";
import WelcomeEmail from "@/emails/welcome-email";
import { createElement } from "react";

/**
 * Send a branded welcome email with a password-set link via Resend.
 */
export async function sendWelcomeEmail(
  to: string,
  name: string,
  passwordTicketUrl: string
): Promise<{ id: string }> {
  const config = getConfig();
  const resend = new Resend(config.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: config.EMAIL_FROM,
    replyTo: config.EMAIL_REPLY_TO,
    to,
    subject: "Set up your HelpUcompli account",
    react: createElement(WelcomeEmail, {
      name,
      passwordTicketUrl,
      expiryDays: Math.floor(config.PASSWORD_TICKET_TTL / 86400),
    }),
  });

  if (error) {
    throw new Error(`Failed to send welcome email: ${error.message}`);
  }

  return { id: data!.id };
}
