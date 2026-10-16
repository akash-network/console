import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";

export class ProfilePage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}/user/settings`);
  }

  async openDeleteAccountDialog() {
    await this.page.getByRole("button", { name: "Delete account" }).click();
  }

  deleteAccountDialog(title: string) {
    return this.page.getByRole("dialog", { name: title });
  }

  async sendDeletionEmail(email: string) {
    const dialog = this.deleteAccountDialog("Delete your account?");
    await dialog.getByLabel(`Type ${email} to confirm`).fill(email);
    await dialog.getByRole("button", { name: "Send confirmation email" }).click();
  }
}
