import type { InboxClient } from "./email-verification/inbox-client";

const INVITATION_TOKEN = /\/invitations#token=([A-Za-z0-9_-]+)/;

/** The invitation email leaves through a queued job and the notifications service, which outruns the OTP mail Auth0 sends. */
const POLL_DEADLINE_MS = 120_000;

const POLL_INTERVAL_MS = 3_000;

/** Reads the token of the invitation emailed to an address no earlier run used, so any invitation found there is this run's. */
export async function waitForInvitationToken(inbox: InboxClient, email: string): Promise<string> {
  const deadline = Date.now() + POLL_DEADLINE_MS;
  const pollErrors: Error[] = [];

  while (Date.now() < deadline) {
    try {
      const token = await findInvitationToken(inbox, email);
      if (token) return token;
    } catch (error) {
      pollErrors.push(error instanceof Error ? error : new Error(String(error)));
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new AggregateError(pollErrors, `No invitation email reached ${email} within ${POLL_DEADLINE_MS / 1_000}s`);
}

async function findInvitationToken(inbox: InboxClient, email: string): Promise<string | undefined> {
  for (const message of await inbox.fetchMessages(email)) {
    const token = (await inbox.fetchMessageBody(email, message.id)).match(INVITATION_TOKEN)?.[1];
    if (token) return token;
  }

  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
