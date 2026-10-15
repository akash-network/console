import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { InboxClient, InboxMessage } from "./email-verification/inbox-client";
import { waitForInvitationEmail } from "./invitation-inbox";

const EMAIL = "e2e-teammate@e2e.example.test";

describe(waitForInvitationEmail.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves once the invitation to the organization is in the inbox", async () => {
    const { inbox } = setup({
      polls: [
        [
          { id: "code", receivedMs: 2, subject: "Your verification code" },
          { id: "invite", receivedMs: 1, subject: "Join Acme on Akash Console" }
        ]
      ]
    });

    await expect(waitForInvitationEmail(inbox, { email: EMAIL, organizationName: "Acme" })).resolves.toBeUndefined();
    expect(inbox.fetchMessages).toHaveBeenCalledWith(EMAIL);
  });

  it("keeps polling through failed reads and invitations to other organizations", async () => {
    vi.useFakeTimers();
    const { inbox } = setup({
      polls: [
        new Error("inbox down"),
        [{ id: "other", receivedMs: 1, subject: "Join Other on Akash Console" }],
        [{ id: "invite", receivedMs: 2, subject: "Join Acme on Akash Console" }]
      ]
    });

    const delivered = waitForInvitationEmail(inbox, { email: EMAIL, organizationName: "Acme" });
    await vi.advanceTimersByTimeAsync(6_000);

    await expect(delivered).resolves.toBeUndefined();
    expect(inbox.fetchMessages).toHaveBeenCalledTimes(3);
  });

  it("gives up after two minutes, naming the email it waited for and keeping the read errors", async () => {
    vi.useFakeTimers();
    const { inbox } = setup({ polls: [new Error("inbox down")] });

    const delivered = waitForInvitationEmail(inbox, { email: EMAIL, organizationName: "Acme" });
    const outcome = expect(delivered).rejects.toMatchObject({
      message: `No "Join Acme on Akash Console" email reached ${EMAIL} within 120s`,
      errors: expect.arrayContaining([expect.objectContaining({ message: "inbox down" })])
    });
    await vi.advanceTimersByTimeAsync(120_000);

    await outcome;
  });

  function setup(input: { polls: (InboxMessage[] | Error)[] }) {
    const inbox = mock<InboxClient>();
    let poll = 0;
    inbox.fetchMessages.mockImplementation(async () => {
      const result = input.polls[Math.min(poll++, input.polls.length - 1)];
      if (result instanceof Error) throw result;
      return result;
    });

    return { inbox };
  }
});
