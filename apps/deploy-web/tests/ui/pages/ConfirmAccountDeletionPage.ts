import type { Page } from "@playwright/test";

export class ConfirmAccountDeletionPage {
  constructor(readonly page: Page) {}

  async goto(link: string) {
    await this.page.goto(link);
  }

  heading(title: string) {
    return this.page.getByRole("heading", { level: 1, name: title });
  }

  async deleteAccount() {
    await this.page.getByRole("button", { name: "Delete my account" }).click();
  }
}
