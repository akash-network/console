import type { BrowserContext as Context, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { PROVIDERS_WHITELIST, testEnvConfig } from "../fixture/test-env.config";

export class DeployPage {
  constructor(
    readonly context: Context,
    readonly page: Page
  ) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}/new-deployment`);
  }

  async selectTemplate(name: string) {
    await this.page.getByLabel(name).or(this.page.getByRole("link", { name })).first().click();
  }

  async openDepositDialog() {
    await this.page.getByRole("button", { name: /create deployment/i }).click();
    const dialog = this.page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    return dialog;
  }

  async createLease(providerName?: string) {
    if (providerName) {
      await this.page.getByLabel(providerName).click();
    } else {
      const providers = PROVIDERS_WHITELIST[testEnvConfig.NETWORK_ID];
      if (!providers.length) {
        await this.page.getByRole("radio", { checked: false }).first().click();
      } else {
        const locator = providers
          .slice(1)
          .reduce(
            (combined, owner) => combined.or(this.page.locator(`[role="radio"][aria-description="${owner}"]`)),
            this.page.locator(`[role="radio"][aria-description="${providers[0]}"]`)
          );
        await locator.first().click({ timeout: 60_000 });
      }
    }

    await this.page.getByRole("button", { name: /accept bid/i }).click();
  }

  async validateLease() {
    await this.page.waitForURL(new RegExp(`${testEnvConfig.BASE_URL}/deployments/\\d+`));
    await this.openTab("Leases");
    await expect(this.page.getByLabel(/URIs/i).getByRole("link").first()).toBeVisible();
    await expect(this.page.getByLabel("Lease 0 state")).toHaveText("active");
  }

  async openTab(name: string) {
    await this.page.getByRole("tab", { name }).click();
  }

  async closeDeployment() {
    await this.page.getByRole("button", { name: /deployment actions/i }).click();
    await this.page.getByRole("menuitem", { name: /close deployment/i }).click();
  }
}
