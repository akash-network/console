import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";
import { escapeRegExp } from "./OrganizationSwitcher";

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

  /** Members are offered under their username, or under their email when they have none. */
  async transferOwnership(memberName: string) {
    await this.page.getByRole("combobox", { name: "New owner" }).click();
    await this.page.getByRole("option", { name: memberName, exact: true }).click();
    await this.page.getByRole("button", { name: "Transfer", exact: true }).click();
    await this.page
      .getByRole("dialog", { name: `Transfer ownership to ${memberName}?` })
      .getByRole("button", { name: "Confirm" })
      .click();
  }

  /** Forfeits whatever credits the team still holds, which only a team with a balance asks about first. */
  async deleteOrganization(organizationName: string) {
    await this.page.getByRole("button", { name: "Delete organization" }).click();
    const forfeitStep = this.page.getByRole("dialog", { name: new RegExp(`^${escapeRegExp(organizationName)} still has .+ in credits$`) });
    const confirmStep = this.page.getByRole("dialog", { name: `Delete ${organizationName}?` });
    await forfeitStep.or(confirmStep).waitFor();
    if (await forfeitStep.isVisible()) {
      await forfeitStep.getByRole("button", { name: "Delete and forfeit" }).click();
      await confirmStep.getByRole("checkbox", { name: /won't be refunded/ }).check();
    }
    await confirmStep.getByLabel(`Type ${organizationName} to confirm`).fill(organizationName);
    await confirmStep.getByRole("button", { name: "Delete organization" }).click();
    await confirmStep.waitFor({ state: "hidden", timeout: 60_000 });
  }

  ownerNotice(input: { ownerName: string; organizationName: string }) {
    return this.page.getByText(`Only the owner, ${input.ownerName}, can delete ${input.organizationName}.`);
  }
}
