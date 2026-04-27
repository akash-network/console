import type { Page } from "@playwright/test";

export class NotificationChannelsPage {
  constructor(readonly page: Page) {}

  async openCreate() {
    await this.page.getByRole("link", { name: /create/i }).click();
    await this.page.waitForURL(/\/alerts\/notification-channels\/new/);
  }

  async fillForm(input: { name: string; emails: string }) {
    await this.page.getByLabel("Name", { exact: true }).fill(input.name);
    await this.page.getByLabel("Emails", { exact: true }).fill(input.emails);
  }

  async submitForm() {
    await this.page.getByRole("button", { name: /^save$/i }).click();
  }

  getChannelRow(name: string) {
    return this.page.getByRole("row").filter({ hasText: name });
  }

  async deleteChannel(name: string) {
    await this.getChannelRow(name)
      .getByRole("button", { name: /remove notification channel/i })
      .click();
    await this.page.getByRole("button", { name: /^confirm$/i }).click();
  }
}
