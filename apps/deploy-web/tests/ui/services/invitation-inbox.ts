import type { InboxClient } from "./email-verification/inbox-client";
import { waitForEmail } from "./inbox-email";

export async function waitForInvitationEmail(inbox: InboxClient, input: { email: string; organizationName: string }): Promise<void> {
  await waitForEmail(inbox, { email: input.email, subject: `Join ${input.organizationName} on Akash Console` });
}
