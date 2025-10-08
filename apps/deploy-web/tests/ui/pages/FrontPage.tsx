import type { BrowserContext as Context, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";

export type FeeType = "low" | "medium" | "high";
export class FrontPage {
  protected readonly feeType: FeeType = "low";

  constructor(
    readonly context: Context = context,
    readonly page: Page
  ) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}`);
  }

  async startTrial() {
    const startTrialButton = this.page.locator('button[aria-label="Start Trial"]');
    await expect(startTrialButton).toBeVisible();
    await startTrialButton.click();
  }

  async closeWelcomeToTrialModal() {
    await expect(this.page.getByTestId("welcome-to-trial-modal")).toBeVisible();
    await this.page.locator('button[aria-label="Close"]').click();
  }
}
