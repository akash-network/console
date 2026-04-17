import type { BrowserContext, Page } from "@playwright/test";

import { testEnvConfig } from "../../fixture/test-env.config";
import type { EmailVerificationStrategy } from "./email-verification.strategy";

export class MailsacVerificationStrategy implements EmailVerificationStrategy {
  private readonly baseUrl = "https://mailsac.com/api";

  constructor(private readonly apiKey: string) {}

  generateEmail(): string {
    return `e2e-${crypto.randomUUID().slice(0, 8)}@mailsac.com`;
  }

  async verify(input: { context: BrowserContext; email: string; userId: string }): Promise<void> {
    const verificationLink = await this.pollForVerificationLink(input.email);

    const page = await input.context.newPage();
    try {
      await page.goto(verificationLink, { waitUntil: "commit" });
      await page.waitForURL(/success=true/, { timeout: 15_000 });

      if (this.auth0RedirectedToRemoteDeployment(page)) {
        await this.syncVerificationViaLocalApp(page, input.email);
      }

      await page.getByText("Your email was verified").waitFor({ timeout: 30_000 });
    } finally {
      await page.close();
    }
  }

  private auth0RedirectedToRemoteDeployment(page: Page): boolean {
    return !page.url().startsWith(testEnvConfig.BASE_URL);
  }

  private async syncVerificationViaLocalApp(page: Page, email: string): Promise<void> {
    const verifyEmailUrl = `${testEnvConfig.BASE_URL}/user/verify-email?email=${encodeURIComponent(email)}`;
    await page.goto(verifyEmailUrl);
  }

  private async pollForVerificationLink(email: string): Promise<string> {
    const maxAttempts = 30;
    const pollIntervalMs = 2_000;

    const errors: Error[] = [];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const messages = await this.fetchMessages(email);

        const verificationMessage = messages.find(m => m.subject?.toLowerCase().includes("verify") || m.subject?.toLowerCase().includes("verification"));

        if (verificationMessage) {
          const message = await this.fetchMessage(email, verificationMessage._id);
          const links: string[] = message.links ?? [];
          const link = links.find(l => l.includes("email-verification"));
          if (link) return link;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new AggregateError(errors, `Verification email not received at ${email} within ${(maxAttempts * pollIntervalMs) / 1_000}s`);
  }

  private async fetchMessages(email: string) {
    return this.fetch<Array<{ _id: string; subject?: string }>>(`${this.baseUrl}/addresses/${email}/messages`);
  }

  private async fetchMessage(email: string, messageId: string) {
    return this.fetch<{ links?: string[] }>(`${this.baseUrl}/addresses/${email}/messages/${messageId}`);
  }

  private async fetch<T>(path: string): Promise<T> {
    const response = await fetch(path, {
      headers: { "Mailsac-Key": this.apiKey }
    });

    if (!response.ok) {
      throw new Error(`Mailsac get message failed (${response.status}): ${await response.text()}`);
    }

    return response.json();
  }
}
