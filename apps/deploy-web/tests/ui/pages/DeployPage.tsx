import type { BrowserContext as Context, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { PROVIDERS_WHITELIST, testEnvConfig } from "../fixture/test-env.config";
import { WebWallet } from "./WebWallet";

export type FeeType = "low" | "medium" | "high";
export type WalletType = "api" | "extension";
export type SignOptions = { feeType?: FeeType; walletType: WalletType };

export class DeployPage {
  protected feeType: FeeType = "low";
  protected walletType: WalletType;

  constructor(
    readonly context: Context,
    readonly page: Page,
    private readonly options: SignOptions = { walletType: "api" }
  ) {
    this.feeType = options.feeType ?? this.feeType;
    this.walletType = options.walletType;
  }

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}/new-deployment`);
  }

  async selectTemplate(name: string) {
    await this.page.getByRole("button", { name }).or(this.page.getByRole("link", { name })).click();
  }

  async fillImageName(name: string) {
    await this.page.getByLabel(/docker image/i).fill(name);
  }

  async generateSSHKeys() {
    const downloadPromise = this.page.waitForEvent("download");
    await this.page.getByRole("button", { name: /generate new key/i }).click();

    return {
      download: await downloadPromise,
      input: this.page.getByLabel(/ssh public key/i)
    };
  }

  async openDepositDialog() {
    await this.page.getByRole("button", { name: /create deployment/i }).click();
    const dialog = this.page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    return dialog;
  }

  async createDeployment() {
    await this.withTxAccepted(async () => {
      await this.page.getByRole("button", { name: /create deployment/i }).click();
      await this.page.getByRole("button", { name: /^continue$/i }).click();
    });
  }

  async createLease(providerName?: string) {
    await this.withTxAccepted(async () => {
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
    });
  }

  async validateLeaseAndClose() {
    await this.validateLease();
    await this.withTxAccepted(async () => {
      await this.closeDeployment();
    });
  }

  async validateLease() {
    await this.page.waitForURL(new RegExp(`${testEnvConfig.BASE_URL}/deployments/\\d+`));
    await this.openTab("Leases");
    await expect(this.page.getByLabel(/URIs/i).getByRole("link").first()).toBeVisible();
    await expect(this.page.getByLabel("Lease 0 state")).toHaveText("active");
  }

  async openTab(name: string) {
    await this.page.getByRole("tab", { name: new RegExp(name, "i") }).click();
  }

  async closeDeployment() {
    await this.page.getByRole("button", { name: /deployment actions/i }).click();
    await this.page.getByRole("menuitem", { name: /close deployment/i }).click();
  }

  private async withTxAccepted(fn: () => Promise<void>) {
    await Promise.all([this.walletType === "extension" ? this.signTransaction() : Promise.resolve(), fn()]);
  }

  async signTransaction() {
    const extension = new WebWallet(this.context, this.page);
    await extension.acceptTransaction(this.feeType);
    await extension.waitForTransaction("success");
  }
}
