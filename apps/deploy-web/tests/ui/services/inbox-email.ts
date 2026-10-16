import type { InboxClient, InboxMessage } from "./email-verification/inbox-client";

/** Console emails leave through a queued job and the notifications service, which outruns the OTP mail Auth0 sends. */
const POLL_DEADLINE_MS = 120_000;

const POLL_INTERVAL_MS = 3_000;

export async function waitForEmail(inbox: InboxClient, input: { email: string; subject: string; receivedAfterMs?: number }): Promise<InboxMessage> {
  const receivedAfterMs = input.receivedAfterMs ?? 0;
  const deadline = Date.now() + POLL_DEADLINE_MS;
  const pollErrors: Error[] = [];

  while (Date.now() < deadline) {
    try {
      const messages = await inbox.fetchMessages(input.email);
      const message = messages.find(candidate => candidate.subject === input.subject && candidate.receivedMs >= receivedAfterMs);
      if (message) return message;
    } catch (error) {
      pollErrors.push(error instanceof Error ? error : new Error(String(error)));
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new AggregateError(pollErrors, `No "${input.subject}" email reached ${input.email} within ${POLL_DEADLINE_MS / 1_000}s`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
