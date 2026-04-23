import type { Page } from "@playwright/test";

export class Sidebar {
  constructor(readonly page: Page) {}

  async openDeploy() {
    await this.page
      .getByRole("link", { name: /^deploy$/i })
      .first()
      .click();
  }

  async openAlerts() {
    await this.page.getByRole("link", { name: /^alerts$/i }).click();
  }
}
