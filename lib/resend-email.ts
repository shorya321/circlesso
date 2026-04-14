// Resend email client
// TODO: Implement in F007

import { getConfig } from "./config";

export async function sendWelcomeEmail(
  to: string,
  name: string,
  passwordTicketUrl: string
): Promise<{ id: string }> {
  // TODO: Implement — send via Resend API with React Email template
  throw new Error("Not implemented — F007");
}
