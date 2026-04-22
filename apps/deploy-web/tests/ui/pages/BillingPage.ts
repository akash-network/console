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

  async submitPayment(amount: string) {
    const dialog = this.page.getByRole("dialog", { name: "Add Funds" });
    await dialog.getByRole("combobox").click();
    await this.page.getByRole("option").first().click();
    await dialog.getByRole("spinbutton", { name: /amount/i }).fill(amount);
    await this.getPayButton().click();
  }
}
