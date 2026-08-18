import type { BrowserContext, Locator, Page } from "@playwright/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { InboxClient, InboxMessage } from "./inbox-client";
import { InboxCodeVerificationStrategy } from "./inbox-code.strategy";

const SINCE_MS = 1_000_000;

describe(InboxCodeVerificationStrategy.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("delegates email generation to the inbox client", () => {
    const { strategy, inbox } = setup();
    inbox.generateEmail.mockReturnValue("e2e-abc@e2e.example.test");

    expect(strategy.generateEmail()).toBe("e2e-abc@e2e.example.test");
  });

  it("submits the first fresh code and resolves when the page leaves /login", async () => {
    const { strategy, context, page } = setup({
      messages: [{ id: "m1", receivedMs: SINCE_MS + 1_000 }],
      bodies: { m1: "Your verification code is: 123456" },
      navigationAway: [Promise.resolve()]
    });

    await strategy.verify({ context, email: "probe@e2e.example.test", userId: "", sinceMs: SINCE_MS });

    expect(page.keyboard.type).toHaveBeenCalledWith("123456");
  });

  it("ignores messages received before the flow started", async () => {
    const { strategy, context, inbox, page } = setup({
      messages: [
        { id: "stale", receivedMs: SINCE_MS - 1 },
        { id: "fresh", receivedMs: SINCE_MS + 1 }
      ],
      bodies: { fresh: "Your verification code is: 654321" },
      navigationAway: [Promise.resolve()]
    });

    await strategy.verify({ context, email: "probe@e2e.example.test", userId: "", sinceMs: SINCE_MS });

    expect(inbox.fetchMessageBody).not.toHaveBeenCalledWith("probe@e2e.example.test", "stale");
    expect(page.keyboard.type).toHaveBeenCalledWith("654321");
  });

  it("tries the next code after the server rejects the newest one", async () => {
    const { strategy, context, page, errorAlert } = setup({
      messages: [
        { id: "older", receivedMs: SINCE_MS + 1_000 },
        { id: "newest", receivedMs: SINCE_MS + 2_000 }
      ],
      bodies: {
        newest: "Your verification code is: 222222",
        older: "Your verification code is: 111111"
      },
      navigationAway: [pending(), Promise.resolve()],
      alertShown: [Promise.resolve(), pending()]
    });
    errorAlert.textContent.mockResolvedValue("Wrong code");

    await strategy.verify({ context, email: "probe@e2e.example.test", userId: "", sinceMs: SINCE_MS });

    expect(page.keyboard.type).toHaveBeenNthCalledWith(1, "222222");
    expect(page.keyboard.type).toHaveBeenNthCalledWith(2, "111111");
  });

  it("fails with the polling summary when no fresh code arrives before the deadline", async () => {
    vi.useFakeTimers();
    const { strategy, context } = setup({ messages: [] });

    const outcome = expect(strategy.verify({ context, email: "probe@e2e.example.test", userId: "", sinceMs: SINCE_MS })).rejects.toThrow(
      /No working verification code arrived for probe@e2e\.example\.test/
    );
    await vi.advanceTimersByTimeAsync(61_000);

    await outcome;
  });

  it("throws when the browser context has no pages", async () => {
    const { strategy } = setup();
    const context = mock<BrowserContext>();
    context.pages.mockReturnValue([]);

    await expect(strategy.verify({ context, email: "probe@e2e.example.test", userId: "", sinceMs: SINCE_MS })).rejects.toThrow("No browser pages available");
  });

  function setup(input?: {
    messages?: InboxMessage[];
    bodies?: Record<string, string>;
    /** One entry per submit attempt: resolve = page left /login, pending() = still on /login. */
    navigationAway?: Array<Promise<void>>;
    /** One entry per submit attempt: resolve = rejection alert appeared, pending() = no alert. */
    alertShown?: Array<Promise<void>>;
  }) {
    const inbox = mock<InboxClient>();
    inbox.fetchMessages.mockResolvedValue(input?.messages ?? []);
    inbox.fetchMessageBody.mockImplementation(async (_email, messageId) => {
      const body = input?.bodies?.[messageId];
      if (body === undefined) throw new Error(`unexpected body fetch for ${messageId}`);
      return body;
    });

    const firstDigitInput = mock<Locator>();
    const errorAlert = mock<Locator>();
    errorAlert.filter.mockReturnValue(errorAlert);
    errorAlert.first.mockReturnValue(errorAlert);
    for (const alertOutcome of input?.alertShown ?? []) {
      errorAlert.waitFor.mockReturnValueOnce(alertOutcome);
    }
    errorAlert.waitFor.mockReturnValue(pending());

    const page = mockDeep<Page>();
    page.getByLabel.mockReturnValue(firstDigitInput);
    page.locator.mockReturnValue(errorAlert);
    page.url.mockReturnValue("https://app.test/login");
    for (const navigationOutcome of input?.navigationAway ?? []) {
      page.waitForURL.mockReturnValueOnce(navigationOutcome);
    }
    page.waitForURL.mockReturnValue(pending());

    const context = mock<BrowserContext>();
    context.pages.mockReturnValue([page]);

    const strategy = new InboxCodeVerificationStrategy(inbox);
    return { strategy, inbox, context, page, errorAlert, firstDigitInput };
  }

  function pending(): Promise<void> {
    return new Promise<void>(() => {});
  }
});
