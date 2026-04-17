import type { BrowserContext } from "@playwright/test";

import { testEnvConfig } from "../../fixture/test-env.config";
import type { Auth0ManagementService } from "../auth0-management.service";
import type { EmailVerificationStrategy } from "./email-verification.strategy";

export class Auth0TicketVerificationStrategy implements EmailVerificationStrategy {
  constructor(private readonly auth0: Auth0ManagementService) {}

  generateEmail(): string {
    return `e2e-${crypto.randomUUID().slice(0, 8)}@test.akash.network`;
  }

  async verify(input: { context: BrowserContext; email: string; userId: string }): Promise<void> {
    const verifyEmailUrl = `${testEnvConfig.BASE_URL}/user/verify-email?email=${encodeURIComponent(input.email)}`;
    const ticketUrl = await this.auth0.createEmailVerificationTicket(input.userId, verifyEmailUrl);

    const page = await input.context.newPage();
    try {
      await page.goto(ticketUrl);
      await page.getByText("Your email was verified").waitFor({ timeout: 15_000 });
    } finally {
      await page.close();
    }
  }
}
