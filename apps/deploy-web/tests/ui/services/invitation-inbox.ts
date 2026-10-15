import type { InboxClient } from "./email-verification/inbox-client";

/** The invitation email leaves through a queued job and the notifications service, which outruns the OTP mail Auth0 sends. */
const POLL_DEADLINE_MS = 120_000;

const POLL_INTERVAL_MS = 3_000;

/** The inbox keeps an email's text without its links, so this proves the invitation was delivered but cannot open it. */
export async function waitForInvitationEmail(inbox: InboxClient, input: { email: string; organizationName: string }): Promise<void> {
  const subject = `Join ${input.organizationName} on Akash Console`;
  const deadline = Date.now() + POLL_DEADLINE_MS;
  const pollErrors: Error[] = [];

  while (Date.now() < deadline) {
    try {
      const messages = await inbox.fetchMessages(input.email);
      if (messages.some(message => message.subject === subject)) return;
    } catch (error) {
      pollErrors.push(error instanceof Error ? error : new Error(String(error)));
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new AggregateError(pollErrors, `No "${subject}" email reached ${input.email} within ${POLL_DEADLINE_MS / 1_000}s`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
