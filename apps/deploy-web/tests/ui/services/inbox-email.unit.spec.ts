import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { InboxClient, InboxMessage } from "./email-verification/inbox-client";
import { waitForEmail } from "./inbox-email";

const EMAIL = "e2e-owner@e2e.example.test";

const SUBJECT = "Confirm your Akash Console account deletion";

describe(waitForEmail.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the email with the subject, links included", async () => {
    const links = [{ text: "Delete my account", href: "https://console.test/user/confirm-delete#token=abc" }];
    const { inbox } = setup({
      polls: [
        [
          { id: "code", receivedMs: 2, subject: "Your verification code" },
          { id: "deletion", receivedMs: 1, subject: SUBJECT, links }
        ]
      ]
    });

    await expect(waitForEmail(inbox, { email: EMAIL, subject: SUBJECT })).resolves.toEqual({ id: "deletion", receivedMs: 1, subject: SUBJECT, links });
    expect(inbox.fetchMessages).toHaveBeenCalledWith(EMAIL);
  });

  it("waits past an email with the subject that arrived before the given time", async () => {
    vi.useFakeTimers();
    const { inbox } = setup({
      polls: [
        [{ id: "earlier", receivedMs: 999, subject: SUBJECT }],
        [
          { id: "later", receivedMs: 1_000, subject: SUBJECT },
          { id: "earlier", receivedMs: 999, subject: SUBJECT }
        ]
      ]
    });

    const delivered = waitForEmail(inbox, { email: EMAIL, subject: SUBJECT, receivedAfterMs: 1_000 });
    await vi.advanceTimersByTimeAsync(3_000);

    await expect(delivered).resolves.toMatchObject({ id: "later" });
    expect(inbox.fetchMessages).toHaveBeenCalledTimes(2);
  });

  function setup(input: { polls: InboxMessage[][] }) {
    const inbox = mock<InboxClient>();
    let poll = 0;
    inbox.fetchMessages.mockImplementation(async () => input.polls[Math.min(poll++, input.polls.length - 1)]);

    return { inbox };
  }
});
