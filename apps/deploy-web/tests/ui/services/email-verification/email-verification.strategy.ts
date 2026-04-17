import type { BrowserContext } from "@playwright/test";

export interface EmailVerificationStrategy {
  generateEmail(): string;
  verify(input: { context: BrowserContext; email: string; userId: string }): Promise<void>;
}
