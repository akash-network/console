import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { InboxClient, InboxMessage } from "./email-verification/inbox-client";
import { waitForInvitationToken } from "./invitation-inbox";

const EMAIL = "e2e-teammate@e2e.example.test";

describe(waitForInvitationToken.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the token from the invitation link and skips mail that holds none", async () => {
    const { inbox } = setup({
      polls: [
        [
          { id: "code", receivedMs: 2 },
          { id: "invite", receivedMs: 1 }
        ]
      ],
      bodies: {
        code: "Your verification code is 123456",
        invite: "Join Acme on Akash Console\nAccept invitation: https://console.example.test/invitations#token=abc_DEF-123\n"
      }
    });

    await expect(waitForInvitationToken(inbox, EMAIL)).resolves.toBe("abc_DEF-123");
    expect(inbox.fetchMessages).toHaveBeenCalledWith(EMAIL);
  });

  it("keeps polling until the invitation arrives, through failed reads", async () => {
    vi.useFakeTimers();
    const { inbox } = setup({
      polls: [new Error("inbox down"), [], [{ id: "invite", receivedMs: 1 }]],
      bodies: { invite: "https://console.example.test/invitations#token=late" }
    });

    const token = waitForInvitationToken(inbox, EMAIL);
    await vi.advanceTimersByTimeAsync(6_000);

    await expect(token).resolves.toBe("late");
    expect(inbox.fetchMessages).toHaveBeenCalledTimes(3);
  });

  it("gives up after two minutes, naming the address and keeping the read errors", async () => {
    vi.useFakeTimers();
    const { inbox } = setup({ polls: [new Error("inbox down")] });

    const token = waitForInvitationToken(inbox, EMAIL);
    const outcome = expect(token).rejects.toMatchObject({
      message: `No invitation email reached ${EMAIL} within 120s`,
      errors: expect.arrayContaining([expect.objectContaining({ message: "inbox down" })])
    });
    await vi.advanceTimersByTimeAsync(120_000);

    await outcome;
  });

  function setup(input: { polls: (InboxMessage[] | Error)[]; bodies?: Record<string, string> }) {
    const inbox = mock<InboxClient>();
    let poll = 0;
    inbox.fetchMessages.mockImplementation(async () => {
      const result = input.polls[Math.min(poll++, input.polls.length - 1)];
      if (result instanceof Error) throw result;
      return result;
    });
    inbox.fetchMessageBody.mockImplementation(async (_, messageId) => input.bodies?.[messageId] ?? "");

    return { inbox };
  }
});
