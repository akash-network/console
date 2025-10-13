import { faker } from "@faker-js/faker";
import type { BrowserContext as Context, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";
import { createWallet } from "../fixture/wallet-setup";

export type FeeType = "low" | "medium" | "high";
export class FrontPage {
  protected readonly feeType: FeeType = "low";

  constructor(
    readonly context: Context,
    readonly page: Page
  ) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}`);
  }

  async createWallet(extensionId: string) {
    const newWalletName = faker.word.adjective();
    await createWallet(this.context, extensionId, newWalletName);
    await this.page.reload({ waitUntil: "domcontentloaded" });

    const container = this.page.getByLabel("Connected wallet name and balance");
    await container.waitFor({ state: "visible", timeout: 20_000 });
    await expect(container).toHaveText(newWalletName);
  }

  async disconnectWallet() {
    await this.page.getByLabel("Connected wallet name and balance").hover();
    await this.page.getByLabel("Disconnect Wallet").click();

    await this.page.reload({ waitUntil: "domcontentloaded" });

    await expect(this.page.getByTestId("connect-wallet-btn")).toBeVisible();
  }
}
