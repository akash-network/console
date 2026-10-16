import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";
import { AddCreditsSheetPage } from "./AddCreditsSheetPage";

export class BillingPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}/billing`);
  }

  async waitForPage() {
    await this.page.waitForURL(/\/billing/);
  }

  async openAddToBalance() {
    await this.page.getByRole("button", { name: /add to balance/i }).click();
  }

  getAvailableBalance() {
    return this.page.locator('[aria-label="Available balance"]');
  }

  async submitPayment(amount: string) {
    const sheet = new AddCreditsSheetPage(this.page);
    await sheet.waitForOpen();
    await sheet.enterCustomAmount(amount);
    await sheet.submit();
  }
}
