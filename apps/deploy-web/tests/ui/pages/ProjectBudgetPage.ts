import type { Page } from "@playwright/test";

/** The "Spend and budget" panel of a project's page, and the dialog that sets the project's monthly budget. */
export class ProjectBudgetPage {
  constructor(readonly page: Page) {}

  panel() {
    return this.page.getByRole("region", { name: "Spend and budget" });
  }

  async setBudget(input: { monthlyAmountUsd: string; alertThresholdPercent: string }) {
    await this.panel().getByRole("button", { name: "Set budget" }).click();
    const dialog = this.page.getByRole("dialog", { name: "Set a monthly budget" });
    await dialog.getByLabel("Monthly budget (USD)").fill(input.monthlyAmountUsd);
    await dialog.getByLabel("Alert threshold (%)").fill(input.alertThresholdPercent);
    await dialog.getByRole("button", { name: "Save budget" }).click();
    await dialog.waitFor({ state: "hidden" });
  }

  /** Named after the share of the monthly budget committed, as in "50% of the monthly budget committed". */
  committedShare() {
    return this.panel().getByRole("progressbar");
  }
}
