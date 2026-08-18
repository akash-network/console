import type { BrowserContext, Page } from "@playwright/test";

import type { EmailVerificationStrategy } from "./email-verification.strategy";
import type { InboxClient, InboxMessage } from "./inbox-client";

/**
 * Match a 6-digit number that appears within ~200 chars after the word "code"
 * (case-insensitive). Anchoring on the keyword avoids matching unrelated 6-digit
 * substrings (timestamps, order IDs) if the inbox ever receives non-OTP mail.
 */
const CODE_NEAR_KEYWORD = /\bcode\b[\s\S]{0,200}?\b(\d{6})\b/i;

/** Total time to wait for a fresh code to arrive before giving up. */
const POLL_DEADLINE_MS = 60_000;

/** First delay between inbox polls; grows exponentially up to the cap to reduce API calls when delivery lags. */
const POLL_INITIAL_INTERVAL_MS = 1_000;

/** Upper bound on the backoff delay between polls. */
const POLL_MAX_INTERVAL_MS = 5_000;

/** How long after typing a code we wait for either successful navigation or a rejection alert. */
const SUBMIT_TIMEOUT_MS = 10_000;

/** How long we tolerate the digit inputs not being ready (just mounted, or being reset after a prior failure). */
const INPUT_READY_TIMEOUT_MS = 5_000;

/**
 * Next.js renders an off-screen `role="alert"` route announcer (`#__next-route-announcer__`) and fills it with
 * `document.title` on every client-side navigation — an accessibility aid, not an error. Excluded from error-alert
 * detection so a normal SPA route change (e.g. entering the OTP step) is not misread as a rejected code.
 */
const NEXT_ROUTE_ANNOUNCER_SELECTOR = "#__next-route-announcer__";

interface CodeCandidate {
  messageId: string;
  code: string;
}

interface CodeAttemptFailure {
  code: string;
  reason: string;
}

type SubmitOutcome = { kind: "success" } | { kind: "rejected"; message: string };

export class InboxCodeVerificationStrategy implements EmailVerificationStrategy {
  readonly #inbox: InboxClient;

  constructor(inbox: InboxClient) {
    this.#inbox = inbox;
  }

  generateEmail(): string {
    return this.#inbox.generateEmail();
  }

  /**
   * Polls the inbox for fresh OTP codes (received after this call started) and tries each
   * in turn. Codes that the server rejects are remembered so we don't try them again.
   * Returns once the form submission succeeds (page leaves /login); throws once polling
   * exhausts without finding a working code.
   */
  async verify(input: { context: BrowserContext; email: string; userId: string; sinceMs: number }): Promise<void> {
    const page = this.#requireActivePage(input.context);
    const triedMessageIds = new Set<string>();
    const scannedWithoutCode = new Set<string>();
    const failures: CodeAttemptFailure[] = [];

    while (true) {
      let candidate: CodeCandidate;
      try {
        candidate = await this.#pollForNextCode(input.email, input.sinceMs, triedMessageIds, scannedWithoutCode);
      } catch (pollError) {
        throw this.#buildExhaustedError(input.email, failures, pollError);
      }

      try {
        await this.#submitCode(page, candidate.code, triedMessageIds.size > 0);
        return;
      } catch (error) {
        triedMessageIds.add(candidate.messageId);
        failures.push({ code: candidate.code, reason: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  #requireActivePage(context: BrowserContext): Page {
    const [page] = context.pages();
    if (!page) throw new Error("No browser pages available to enter verification code");
    return page;
  }

  async #pollForNextCode(email: string, freshAfterMs: number, excludeMessageIds: Set<string>, scannedWithoutCode: Set<string>): Promise<CodeCandidate> {
    const pollErrors: Error[] = [];
    const deadline = Date.now() + POLL_DEADLINE_MS;
    let interval = POLL_INITIAL_INTERVAL_MS;

    while (true) {
      try {
        const messages = await this.#inbox.fetchMessages(email);
        for (const message of messagesNewestFirst(messages)) {
          if (excludeMessageIds.has(message.id) || scannedWithoutCode.has(message.id)) continue;
          if (message.receivedMs < freshAfterMs) continue;
          const body = await this.#inbox.fetchMessageBody(email, message.id);
          const code = body.match(CODE_NEAR_KEYWORD)?.[1];
          if (code) {
            return { messageId: message.id, code };
          }
          scannedWithoutCode.add(message.id);
        }
      } catch (error) {
        pollErrors.push(error instanceof Error ? error : new Error(String(error)));
      }

      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      await sleep(Math.min(interval, remaining));
      interval = Math.min(interval * 2, POLL_MAX_INTERVAL_MS);
    }

    throw new AggregateError(
      pollErrors,
      `No fresh verification code found for ${email} within ${POLL_DEADLINE_MS / 1_000}s (excluded ${excludeMessageIds.size} tried)`
    );
  }

  async #submitCode(page: Page, code: string, mustWaitForInputClear: boolean): Promise<void> {
    const firstDigitInput = page.getByLabel("Verification code digit 1");
    await firstDigitInput.waitFor({ state: "visible", timeout: INPUT_READY_TIMEOUT_MS });
    if (mustWaitForInputClear) {
      await this.#waitForFirstDigitCleared(page);
    }

    await firstDigitInput.click();
    await page.keyboard.type(code);

    const outcome = await this.#awaitSubmitOutcome(page);
    if (outcome.kind === "success") return;
    throw new Error(`server rejected code (alert: "${outcome.message}", url: ${page.url()})`);
  }

  async #waitForFirstDigitCleared(page: Page): Promise<void> {
    await page.waitForFunction(
      () => {
        const input = document.querySelector('input[aria-label="Verification code digit 1"]') as HTMLInputElement | null;
        return input !== null && input.value === "";
      },
      { timeout: INPUT_READY_TIMEOUT_MS }
    );
  }

  async #awaitSubmitOutcome(page: Page): Promise<SubmitOutcome> {
    const errorAlert = page.locator(`[role="alert"]:not(${NEXT_ROUTE_ANNOUNCER_SELECTOR})`).filter({ hasText: /\S/ }).first();

    const whenNavigatedAway = page
      .waitForURL(url => !url.pathname.includes("/login"), { timeout: SUBMIT_TIMEOUT_MS })
      .then<SubmitOutcome>(() => ({ kind: "success" }));

    const whenAlertShown = errorAlert.waitFor({ state: "visible", timeout: SUBMIT_TIMEOUT_MS }).then<SubmitOutcome>(async () => {
      if (!page.url().includes("/login")) return { kind: "success" };
      const message = (await errorAlert.textContent())?.trim() || "alert visible but empty";
      return { kind: "rejected", message };
    });

    return Promise.race([whenNavigatedAway, whenAlertShown]);
  }

  #buildExhaustedError(email: string, failures: CodeAttemptFailure[], pollError: unknown): Error {
    const failureList = failures.length ? failures.map(({ code, reason }) => `  - ${code}: ${reason}`).join("\n") : "  - none";
    const summary = `No working verification code arrived for ${email}. Tried ${failures.length} code(s):\n${failureList}`;
    if (pollError instanceof AggregateError && pollError.errors.length > 0) {
      return new AggregateError(pollError.errors, `${summary}\nPolling errors: ${pollError.message}`);
    }
    return new Error(`${summary}\nPolling: ${pollError instanceof Error ? pollError.message : String(pollError)}`);
  }
}

/**
 * Sorts a copy newest-first so the most recent (and most likely OTP) message is scanned
 * before older ones — the working code is then found in the fewest body fetches.
 */
function messagesNewestFirst(messages: InboxMessage[]): InboxMessage[] {
  return [...messages].sort((a, b) => b.receivedMs - a.receivedMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
