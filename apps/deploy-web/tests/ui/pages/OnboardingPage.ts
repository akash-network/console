import type { Page } from "@playwright/test";

export class OnboardingPage {
  constructor(readonly page: Page) {}

  /**
   * Resolves true once the app has settled on the onboarding flow
   * i.e. the current user is new and not yet onboarded.
   */
  async isCurrentPage(): Promise<boolean> {
    await this.page.waitForURL(/\/onboarding/, { timeout: 30_000, waitUntil: "commit" });
    return /\/onboarding/.test(new URL(this.page.url()).pathname);
  }

  async startFreeTrial() {
    await this.page.getByRole("button", { name: /start free trial/i }).click();
  }
}
