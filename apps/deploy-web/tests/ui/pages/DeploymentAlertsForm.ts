import type { Page } from "@playwright/test";

export class DeploymentAlertsForm {
  constructor(readonly page: Page) {}

  getCloseEnabledToggle() {
    return this.page.getByRole("checkbox", { name: "Deployment Closed" });
  }

  getCloseChannelSelect() {
    return this.page.getByRole("combobox", { name: "Notification Channel" });
  }

  async saveChanges() {
    await this.page.getByRole("button", { name: /save changes/i }).click();
    await this.page.getByText("Alert configured!").waitFor({ state: "visible", timeout: 10_000 });
    await this.page.getByText("Alert configured!").waitFor({ state: "hidden", timeout: 10_000 });
  }
}
