import type { BrowserContext } from "@playwright/test";

import type { EmailVerificationStrategy } from "./email-verification.strategy";

export class MailsacCodeVerificationStrategy implements EmailVerificationStrategy {
  private readonly baseUrl = "https://mailsac.com/api";

  constructor(private readonly apiKey: string) {}

  generateEmail(): string {
    return `e2e-${crypto.randomUUID().slice(0, 8)}@mailsac.com`;
  }

  async verify(input: { context: BrowserContext; email: string; userId: string }): Promise<void> {
    const code = await this.pollForVerificationCode(input.email);
    const pages = input.context.pages();

    if (pages.length === 0) {
      throw new Error("No browser pages available to enter verification code");
    }

    const page = pages[0];
    const firstDigitInput = page.getByLabel("Verification code digit 1");
    await firstDigitInput.click();
    await page.keyboard.type(code);
  }

  private async pollForVerificationCode(email: string): Promise<string> {
    const maxAttempts = 30;
    const pollIntervalMs = 2_000;
    const errors: Error[] = [];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const messages = await this.fetchMessages(email);

        const verificationMessage = messages.find(m => m.subject?.toLowerCase().includes("verif") || m.subject?.toLowerCase().includes("code"));

        if (verificationMessage) {
          const body = await this.fetchMessageBody(email, verificationMessage._id);
          const match = body.match(/\b(\d{6})\b/);
          if (match) return match[1];
        }
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new AggregateError(errors, `Verification code email not received at ${email} within ${(maxAttempts * pollIntervalMs) / 1_000}s`);
  }

  private async fetchMessages(email: string) {
    return this.fetch<Array<{ _id: string; subject?: string }>>(`${this.baseUrl}/addresses/${email}/messages`);
  }

  private async fetchMessageBody(email: string, messageId: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/text/${email}/${messageId}`, {
      headers: { "Mailsac-Key": this.apiKey }
    });

    if (!response.ok) {
      throw new Error(`Mailsac body fetch failed (${response.status}): ${await response.text()}`);
    }

    return response.text();
  }

  private async fetch<T>(path: string): Promise<T> {
    const response = await fetch(path, {
      headers: { "Mailsac-Key": this.apiKey }
    });

    if (!response.ok) {
      throw new Error(`Mailsac request failed (${response.status}): ${await response.text()}`);
    }

    return response.json();
  }
}
