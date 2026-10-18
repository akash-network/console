import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";

export class OrganizationSettingsPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}/organization`);
  }

  heading() {
    return this.page.getByRole("heading", { level: 1, name: "General" });
  }

  async leave(organizationName: string) {
    await this.page.getByRole("button", { name: "Leave organization" }).click();
    await this.page
      .getByRole("dialog", { name: `Leave ${organizationName}?` })
      .getByRole("button", { name: "Leave organization" })
      .click();
  }

  async rename(name: string) {
    const nameInput = this.page.getByRole("textbox", { name: "Name" });
    await nameInput.fill(name);
    await this.page.getByRole("button", { name: "Save" }).click();
  }

  async delete(organizationName: string) {
    await this.page.getByRole("button", { name: "Delete organization" }).click();
    await this.confirmDeletion(organizationName);
  }

  /** A team that still holds credits asks the owner to forfeit them before asking for its name. */
  async deleteForfeitingCredits(organizationName: string) {
    await this.page.getByRole("button", { name: "Delete organization" }).click();
    await this.page.getByRole("button", { name: "Delete and forfeit" }).click();
    await this.deletionDialog(organizationName)
      .getByRole("checkbox", { name: /credits won't be refunded\.$/ })
      .check();
    await this.confirmDeletion(organizationName);
  }

  private deletionDialog(organizationName: string) {
    return this.page.getByRole("dialog", { name: `Delete ${organizationName}?` });
  }

  private async confirmDeletion(organizationName: string) {
    const dialog = this.deletionDialog(organizationName);
    await dialog.getByRole("textbox", { name: `Type ${organizationName} to confirm` }).fill(organizationName);
    await dialog.getByRole("button", { name: "Delete organization" }).click();
  }
}
