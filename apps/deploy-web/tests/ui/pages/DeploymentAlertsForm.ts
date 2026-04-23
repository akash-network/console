import type { Page } from "@playwright/test";

export class DeploymentAlertsForm {
  constructor(readonly page: Page) {}

  private getSection(label: string) {
    return this.page.getByLabel(label);
  }

  getEscrowEnabledToggle() {
    return this.getSection("Escrow Balance").getByRole("checkbox", { name: /enabled/i });
  }

  getEscrowThresholdInput() {
    return this.getSection("Escrow Balance").getByRole("spinbutton");
  }

  getEscrowChannelSelect() {
    return this.getSection("Escrow Balance").getByRole("combobox").first();
  }

  getCloseEnabledToggle() {
    return this.getSection("Deployment Close").getByRole("checkbox", { name: /enabled/i });
  }

  getCloseChannelSelect() {
    return this.getSection("Deployment Close").getByRole("combobox").first();
  }

  async saveChanges() {
    await this.page.getByRole("button", { name: /save changes/i }).click();
    await this.page.getByText("Alert configured!").waitFor({ state: "visible", timeout: 10_000 });
    await this.page.getByText("Alert configured!").waitFor({ state: "hidden", timeout: 10_000 });
  }

  async setEscrowThreshold(value: string) {
    const input = this.getEscrowThresholdInput();
    await input.clear();
    await input.fill(value);
  }
}
