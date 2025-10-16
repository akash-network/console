import { faker } from "@faker-js/faker";
import type { BrowserContext as Context, Page } from "@playwright/test";

import { wait } from "@src/utils/timer";
import { testEnvConfig } from "../fixture/test-env.config";
import { clickConnectWalletButton } from "../fixture/testing-helpers";
import { createWallet } from "../fixture/wallet-setup";

export class LeapExt {
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

    const [popup] = await Promise.all([
      this.context.waitForEvent("page"),
      wait(100).then(() => {
        this.page.reload({ waitUntil: "domcontentloaded" });
      })
    ]);
    await clickConnectWalletButton(popup);

    return newWalletName;
  }

  async disconnectWallet() {
    await this.page.getByLabel("Connected wallet name and balance").hover();
    await this.page.getByRole("button", { name: "Disconnect Wallet" }).click();

    await this.page.reload({ waitUntil: "domcontentloaded" });
  }
}
