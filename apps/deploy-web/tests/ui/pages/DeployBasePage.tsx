import type { BrowserContext as Context, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { PROVIDERS_WHITELIST, testEnvConfig } from "../fixture/test-env.config";
import { LeapExt } from "./LeapExt";

export type FeeType = "low" | "medium" | "high";
export class DeployBasePage {
  protected readonly feeType: FeeType = "low";

  constructor(
    readonly context: Context = context,
    readonly page: Page,
    readonly path: string,
    readonly cardTestId?: string
  ) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}/${this.path}`);
  }

  async gotoInteractive(skipInit?: boolean) {
    if (this.cardTestId) {
      if (!skipInit) {
        await this.page.goto(testEnvConfig.BASE_URL);
      }
      await this.page.getByTestId("sidebar-deploy-button").first().click();
      await this.page.getByTestId(this.cardTestId).click();
    }
  }

  async generateSSHKeys() {
    const downloadPromise = this.page.waitForEvent("download");
    await this.page.getByTestId("generate-ssh-keys-btn").click();

    return {
      download: await downloadPromise,
      input: this.page.getByTestId("ssh-public-key-input")
    };
  }

  async createDeployment() {
    await this.page.getByTestId("monaco-editor").waitFor({ state: "visible", timeout: 10_000 });
    await this.page.getByTestId("create-deployment-btn").click();
    await this.page.getByTestId("deposit-modal-continue-button").click();
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
          .reduce((combinedLocator, provider) => combinedLocator.or(this.page.getByLabel(provider)), this.page.getByLabel(providers[0]));
        await locator.first().click();
      }
    }

    await this.page.getByTestId("create-lease-button").click();
  }

  async validateLease() {
    await this.page.waitForURL(new RegExp(`${testEnvConfig.BASE_URL}/deployments/\\d+`));
    await this.page.getByRole("tab", { name: /Leases/i }).click();
    await this.page.getByLabel(/URIs/i).getByRole("link").first().isVisible();
    await expect(this.page.getByTestId("lease-row-0-state")).toHaveText("active");
  }

  async closeDeploymentDetail() {
    await this.page.getByTestId("deployment-detail-dropdown").click();
    await this.page.getByTestId("deployment-detail-close-button").click();
  }

  async signTransaction(feeType: FeeType = this.feeType) {
    const extension = new LeapExt(this.context, this.page);
    await extension.acceptTransaction(feeType);
    await extension.waitForTransaction("success");
  }
}
