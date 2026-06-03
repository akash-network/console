import type { Locator, Page } from "@playwright/test";

export class AlertsPage {
  constructor(readonly page: Page) {}

  async waitForPage() {
    await this.page.waitForURL(/\/alerts/);
  }

  async openAlertsTab() {
    await this.page.getByRole("tab", { name: /^alerts$/i }).click();
  }

  async openNotificationChannelsTab() {
    await this.page.getByRole("tab", { name: /notification channels/i }).click();
  }

  getAlertRow(index: number) {
    return this.page.getByRole("row").nth(index + 1);
  }

  getAlertToggle(row: Locator) {
    return row.getByRole("checkbox", { name: /toggle alert/i });
  }

  async findAlertRowByDseq(dseq: string, options: { timeout?: number } = {}) {
    const { timeout = 30_000 } = options;
    const deadline = Date.now() + timeout;
    // Each deployment renders two rows on /alerts (Escrow Threshold + Deployment Close),
    // both containing the same DSEQ — scope to the first to avoid strict-mode violations
    // on downstream toggle/link actions.
    const row = this.page.getByRole("row").filter({ hasText: dseq }).first();
    const nextButton = this.page.getByRole("link", { name: /go to next page/i });

    while (Date.now() < deadline) {
      try {
        await row.waitFor({ state: "visible", timeout: 2_000 });
        return row;
      } catch {
        // not on this page; fall through and try the next one
      }

      const nextVisible = await nextButton.isVisible().catch(() => false);
      if (!nextVisible) break;
      const ariaDisabled = await nextButton.getAttribute("aria-disabled").catch(() => null);
      if (ariaDisabled === "true") break;

      await nextButton.click();
    }

    throw new Error(`Alert row for DSEQ ${dseq} not found in alerts list`);
  }
}
