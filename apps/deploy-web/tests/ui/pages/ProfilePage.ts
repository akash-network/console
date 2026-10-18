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

  /** Titled after the amount at stake, which the balance decides. */
  forfeitCreditsDialog() {
    return this.page.getByRole("dialog", { name: /^You still have .+ in credits$/ });
  }

  async forfeitCredits() {
    await this.forfeitCreditsDialog().getByRole("button", { name: "Delete and forfeit" }).click();
  }

  async sendDeletionEmail(email: string, options: { acknowledgeForfeit?: boolean } = {}) {
    const dialog = this.deleteAccountDialog("Delete your account?");
    if (options.acknowledgeForfeit) {
      await dialog.getByRole("checkbox", { name: /won't be refunded/ }).check();
    }
    await dialog.getByLabel(`Type ${email} to confirm`).fill(email);
    await dialog.getByRole("button", { name: "Send confirmation email" }).click();
  }
}
