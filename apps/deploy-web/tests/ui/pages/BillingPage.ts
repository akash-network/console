import type { Page } from "@playwright/test";
import { readFile } from "fs/promises";

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

  /** Rendered only while the active organization's wallet is on a free trial. */
  trialPanel() {
    return this.page.getByRole("region", { name: "Free trial" });
  }

  emptyPaymentHistoryNotice() {
    return this.page.getByText("No payments in this period", { exact: true });
  }

  /** A card payment is listed under the card's brand and last four digits. */
  cardPayment(cardLast4: string) {
    return this.page
      .getByRole("table", { name: "Payment history" })
      .getByRole("row")
      .filter({ hasText: `**** ${cardLast4}` });
  }

  async exportPaymentHistoryCsv(): Promise<string> {
    const [download] = await Promise.all([this.page.waitForEvent("download"), this.page.getByRole("button", { name: "Export as CSV" }).click()]);

    return await readFile(await download.path(), "utf8");
  }

  async submitPayment(amount: string) {
    const sheet = new AddCreditsSheetPage(this.page);
    await sheet.waitForOpen();
    await sheet.enterCustomAmount(amount);
    await sheet.submit();
  }
}
