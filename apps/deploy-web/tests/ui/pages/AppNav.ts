import type { Page } from "@playwright/test";

export class AppNav {
  constructor(readonly page: Page) {}

  accountMenuButton() {
    return this.page.getByRole("button", { name: /account menu/i });
  }

  async openDeployments() {
    await this.page
      .getByRole("link", { name: /^deployments$/i })
      .first()
      .click();
  }

  deployLink() {
    return this.page.getByRole("link", { name: /^new deployment$/i }).first();
  }

  async openDeploy() {
    await this.openDeployments();
    await this.deployLink().click();
  }

  async openAlerts() {
    await this.page.getByRole("button", { name: /^settings$/i }).click();
    await this.page.getByRole("menuitem", { name: /^alerts$/i }).click();
  }

  async openApiKeys() {
    await this.page.getByRole("button", { name: /^settings$/i }).click();
    await this.page.getByRole("menuitem", { name: /^api keys$/i }).click();
  }
}
