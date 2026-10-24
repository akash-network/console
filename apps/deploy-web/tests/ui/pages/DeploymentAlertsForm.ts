import type { Page } from "@playwright/test";

export class DeploymentAlertsForm {
  constructor(readonly page: Page) {}

  getCloseEnabledToggle() {
    return this.page.getByRole("checkbox", { name: "Deployment Closed" });
  }

  getCloseChannelSelect() {
    return this.page.getByRole("combobox", { name: "Notification Channel" });
  }

  async selectCloseChannel(channelName: string) {
    await this.getCloseChannelSelect().click();
    await this.page.getByRole("option", { name: channelName, exact: true }).click();
  }

  /** Opens the channel dialog, which selects the channel it creates for the alert. */
  async openAddNotificationChannel() {
    await this.page.getByRole("button", { name: "Add notification channel" }).click();
  }

  async saveChanges() {
    await this.page.getByRole("button", { name: /save changes/i }).click();
    await this.page.getByText("Alert configured!").waitFor({ state: "visible", timeout: 10_000 });
    await this.page.getByText("Alert configured!").waitFor({ state: "hidden", timeout: 10_000 });
  }
}
