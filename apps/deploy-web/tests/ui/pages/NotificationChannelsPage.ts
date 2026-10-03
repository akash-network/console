import type { Page } from "@playwright/test";

export class NotificationChannelsPage {
  constructor(readonly page: Page) {}

  getChannelDialog() {
    return this.page.getByRole("dialog", { name: /notification channel/i });
  }

  async openCreate() {
    await this.page.getByRole("button", { name: /^add channel$/i }).click();
    await this.getChannelDialog().waitFor();
  }

  async fillForm(input: { name: string; emails: string }) {
    const dialog = this.getChannelDialog();
    await dialog.getByLabel("Name", { exact: true }).fill(input.name);
    await dialog.getByLabel("Emails", { exact: true }).fill(input.emails);
  }

  async submitForm() {
    await this.getChannelDialog()
      .getByRole("button", { name: /^(add channel|save changes)$/i })
      .click();
  }

  getChannelRow(name: string) {
    return this.page.getByRole("row").filter({ hasText: name });
  }

  async deleteChannel(name: string) {
    await this.getChannelRow(name)
      .getByRole("button", { name: `Delete ${name}` })
      .click();
    await this.page
      .getByRole("dialog")
      .getByRole("button", { name: /^delete$/i })
      .click();
  }

  async ensureOnTheLastPage() {
    const pagination = this.page.getByRole("navigation", { name: "pagination" });
    if (!(await pagination.isVisible())) {
      return;
    }

    await pagination.getByRole("link", { name: /\d+/ }).last().click();
  }
}
