import type { Locator, Page } from "@playwright/test";

export class AlertsPage {
  constructor(readonly page: Page) {}

  async waitForPage() {
    await this.page.waitForURL(/\/alerts/);
  }

  async openAlertsTab() {
    await this.page.getByRole("tab", { name: /^alerts$/i }).click();
  }

  getAlertRow(index: number) {
    return this.page.getByRole("row").nth(index + 1);
  }

  getAlertToggle(row: Locator) {
    return row.getByRole("checkbox", { name: /toggle alert/i });
  }
}
