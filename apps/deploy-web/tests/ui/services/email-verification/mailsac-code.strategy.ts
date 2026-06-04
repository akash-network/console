import type { BrowserContext, Page } from "@playwright/test";

import type { EmailVerificationStrategy } from "./email-verification.strategy";

/**
 * Match a 6-digit number that appears within ~200 chars after the word "code"
 * (case-insensitive). Anchoring on the keyword avoids matching unrelated 6-digit
 * substrings (timestamps, order IDs) if the inbox ever receives non-OTP mail.
 */
const CODE_NEAR_KEYWORD = /\bcode\b[\s\S]{0,200}?\b(\d{6})\b/i;

/** Delay between Mailsac inbox polls while waiting for a fresh code. */
const POLL_INTERVAL_MS = 2_000;

/** Maximum poll cycles before giving up on a fresh code arriving. ~60s at default interval. */
const POLL_MAX_ATTEMPTS = 30;

/** How long after typing a code we wait for either successful navigation or a rejection alert. */
const SUBMIT_TIMEOUT_MS = 10_000;

/** How long we tolerate the digit inputs not being ready (just mounted, or being reset after a prior failure). */
const INPUT_READY_TIMEOUT_MS = 5_000;

interface MailsacMessage {
  _id: string;
  subject?: string;
  received?: string;
}

interface CodeCandidate {
  messageId: string;
  code: string;
}

interface CodeAttemptFailure {
  code: string;
  reason: string;
}

type SubmitOutcome = { kind: "success" } | { kind: "rejected"; message: string };

export class MailsacCodeVerificationStrategy implements EmailVerificationStrategy {
  readonly #baseUrl = "https://mailsac.com/api";
  readonly #apiKey: string;

  constructor(apiKey: string) {
    this.#apiKey = apiKey;
  }

  generateEmail(): string {
    return `e2e-${crypto.randomUUID().slice(0, 8)}@mailsac.com`;
  }

  /**
   * Polls Mailsac for fresh OTP codes (received after this call started) and tries each
   * in turn. Codes that the server rejects are remembered so we don't try them again.
   * Returns once the form submission succeeds (page leaves /login); throws once polling
   * exhausts without finding a working code.
   */
  async verify(input: { context: BrowserContext; email: string; userId: string; sinceMs: number }): Promise<void> {
    const page = this.#requireActivePage(input.context);
    const triedMessageIds = new Set<string>();
    const failures: CodeAttemptFailure[] = [];

    for (;;) {
      let candidate: CodeCandidate;
      try {
        candidate = await this.#pollForNextCode(input.email, input.sinceMs, triedMessageIds);
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

  async #pollForNextCode(email: string, freshAfterMs: number, excludeMessageIds: Set<string>): Promise<CodeCandidate> {
    const pollErrors: Error[] = [];

    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      try {
        const messages = await this.#fetchMessages(email);
        for (const message of messages) {
          if (excludeMessageIds.has(message._id)) continue;
          if (!isMessageFreshSince(message, freshAfterMs)) continue;
          const body = await this.#fetchMessageBody(email, message._id);
          const code = body.match(CODE_NEAR_KEYWORD)?.[1];
          if (code) return { messageId: message._id, code };
        }
      } catch (error) {
        pollErrors.push(error instanceof Error ? error : new Error(String(error)));
      }

      await sleep(POLL_INTERVAL_MS);
    }

    const timeoutSec = (POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS) / 1_000;
    throw new AggregateError(pollErrors, `No fresh verification code found for ${email} within ${timeoutSec}s (excluded ${excludeMessageIds.size} tried)`);
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
    const errorAlert = page.locator('[role="alert"]').filter({ hasText: /\S/ }).first();

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

  #fetchMessages(email: string): Promise<MailsacMessage[]> {
    return this.#fetch<MailsacMessage[]>(`${this.#baseUrl}/addresses/${email}/messages`);
  }

  async #fetchMessageBody(email: string, messageId: string): Promise<string> {
    const response = await fetch(`${this.#baseUrl}/text/${email}/${messageId}`, {
      headers: { "Mailsac-Key": this.#apiKey }
    });
    if (!response.ok) {
      throw new Error(`Mailsac body fetch failed (${response.status}): ${await response.text()}`);
    }
    return response.text();
  }

  async #fetch<T>(path: string): Promise<T> {
    const response = await fetch(path, {
      headers: { "Mailsac-Key": this.#apiKey }
    });
    if (!response.ok) {
      throw new Error(`Mailsac request failed (${response.status}): ${await response.text()}`);
    }
    return response.json();
  }
}

function isMessageFreshSince(message: MailsacMessage, freshAfterMs: number): boolean {
  const receivedMs = message.received ? Date.parse(message.received) : NaN;
  return !Number.isNaN(receivedMs) && receivedMs >= freshAfterMs;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
