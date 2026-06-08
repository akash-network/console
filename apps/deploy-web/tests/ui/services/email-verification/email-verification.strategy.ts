import type { BrowserContext } from "@playwright/test";

export interface EmailVerificationStrategy {
  generateEmail(): string;
  /**
   * `sinceMs` is the epoch millisecond captured before the action that triggers the verification email
   * (signup click, passwordless start, etc.). Mailbox-polling strategies use it to ignore stale
   * messages; strategies that don't poll mailboxes (e.g., Auth0 ticket) ignore it.
   */
  verify(input: { context: BrowserContext; email: string; userId: string; sinceMs: number }): Promise<void>;
}
