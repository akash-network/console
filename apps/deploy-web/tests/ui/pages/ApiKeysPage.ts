import type { Page } from "@playwright/test";

export class ApiKeysPage {
  constructor(readonly page: Page) {}

  async waitForPage() {
    await this.page.waitForURL(/\/user\/api-keys/);
  }

  async createKey(name: string) {
    await this.page.getByRole("button", { name: "Create new key" }).click();
    const dialog = this.page.getByRole("dialog", { name: "Create a new API key" });
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByRole("button", { name: "Create key" }).click();
  }

  getCreatedKeyDialog(name: string) {
    return this.page.getByRole("dialog", { name: `“${name}” is ready` });
  }

  getCreatedKeySecret(name: string) {
    return this.getCreatedKeyDialog(name).getByLabel("API key secret");
  }

  async closeCreatedKeyDialog(name: string) {
    await this.getCreatedKeyDialog(name).getByRole("button", { name: "Done" }).click();
  }

  getKeyRow(name: string) {
    return this.page.getByRole("list", { name: "API keys" }).getByRole("listitem").filter({ hasText: name });
  }

  async revokeKey(name: string) {
    await this.getKeyRow(name)
      .getByRole("button", { name: `Actions for ${name}` })
      .click();
    await this.page.getByRole("menuitem", { name: "Revoke key" }).click();
    await this.page
      .getByRole("dialog", { name: `Revoke “${name}”?` })
      .getByRole("button", { name: "Revoke key" })
      .click();
  }
}
