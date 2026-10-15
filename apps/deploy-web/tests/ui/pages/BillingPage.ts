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

  /**
   * The purchase celebration overlay heading. Scoped to the success dialog so it
   * does not also match the polling provider's "Payment successful!" snackbar
   * (role="alert"), which renders the same words and is visible at the same time.
   */
  getPaymentSuccessMessage() {
    return this.page.getByRole("dialog").getByRole("heading", { name: "Payment Successful!" });
  }

  async submitPayment(amount: string) {
    const sheet = new AddCreditsSheetPage(this.page);
    await sheet.waitForOpen();
    await sheet.enterCustomAmount(amount);
    await sheet.submit();
  }
}
