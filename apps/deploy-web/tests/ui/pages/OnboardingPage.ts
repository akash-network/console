import type { Page } from "@playwright/test";

export class OnboardingPage {
  constructor(readonly page: Page) {}

  async startFreeTrial() {
    await this.page.getByRole("button", { name: /start free trial/i }).click();
  }

  getEmailVerifiedAlert() {
    return this.page.getByText("Email Verified");
  }

  getCheckVerificationButton() {
    return this.page.getByRole("button", { name: /check verification/i });
  }

  getContinueButton() {
    return this.page.getByRole("button", { name: /^continue$/i });
  }
}
