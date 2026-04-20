import type { Page } from "@playwright/test";

export class BillingPage {
  constructor(readonly page: Page) {}

  async waitForPage() {
    await this.page.waitForURL(/\/billing/);
  }

  getAvailableBalance() {
    return this.page.locator('[aria-label="Available balance amount"]');
  }

  getPayButton() {
    return this.page.getByRole("button", { name: /^pay \$/i });
  }
}
