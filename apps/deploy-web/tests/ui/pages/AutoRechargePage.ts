import type { Page } from "@playwright/test";

/** The auto recharge row under the billing page's account balance, and the settings popup it opens. */
export class AutoRechargePage {
  constructor(readonly page: Page) {}

  switch() {
    return this.page.getByRole("switch", { name: "Auto recharge" });
  }

  settingsDialog() {
    return this.page.getByRole("dialog", { name: "Auto recharge settings" });
  }

  /** Turning the switch on opens the settings first, and only saving them turns auto recharge on. */
  async turnOnWithFixedThreshold(input: { thresholdUsd: string; amountUsd: string }) {
    await this.switch().click();
    const dialog = this.settingsDialog();
    await dialog.waitFor({ state: "visible" });
    await dialog.getByRole("radio", { name: /^Fixed threshold/ }).check();
    await dialog.getByLabel(/^When credit balance drops to or below/).fill(input.thresholdUsd);
    await dialog.getByLabel(/^Purchase this amount/).fill(input.amountUsd);
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await dialog.waitFor({ state: "hidden" });
  }

  async turnOff() {
    await this.switch().click();
    await this.page.getByRole("dialog", { name: "Turn off auto recharge?" }).getByRole("button", { name: "Confirm" }).click();
  }
}
