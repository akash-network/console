import type { Page } from "@playwright/test";

import { AddCreditsSheetPage } from "./AddCreditsSheetPage";

export class BillingPage {
  constructor(readonly page: Page) {}

  async waitForPage() {
    await this.page.waitForURL(/\/billing/);
  }

  getAvailableBalance() {
    return this.page.locator('[aria-label="Available balance amount"]');
  }

  async submitPayment(amount: string) {
    const sheet = new AddCreditsSheetPage(this.page);
    await sheet.waitForOpen();
    await sheet.getDialog().getByLabel("custom-amount").fill(amount);
    await sheet.submit();
  }
}
