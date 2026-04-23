import type { Page } from "@playwright/test";

export class ApiKeysPage {
  constructor(readonly page: Page) {}

  async waitForPage() {
    await this.page.waitForURL(/\/user\/api-keys/);
  }

  async createKey(name: string) {
    await this.page.getByRole("button", { name: /create key/i }).click();
    const dialog = this.page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByRole("button", { name: /create key/i }).click();
  }

  getSaveKeyDialog() {
    return this.page.getByRole("dialog", { name: /save your key/i });
  }

  async dismissSaveDialog() {
    await this.getSaveKeyDialog().getByRole("button", { name: /done/i }).click();
  }

  getKeyRow(name: string) {
    return this.page.getByRole("row").filter({ hasText: name });
  }

  async deleteKey(name: string) {
    await this.getKeyRow(name).getByRole("button").click();
    await this.page.getByRole("button", { name: /confirm/i }).click();
  }
}
