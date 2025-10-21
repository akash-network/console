import type { BrowserContext as Context, Page } from "@playwright/test";

import { wait } from "@src/utils/timer";
import { testEnvConfig } from "../fixture/test-env.config";
import { clickConnectWalletButton } from "../fixture/testing-helpers";
import { changeWallet } from "../fixture/wallet-setup";

export class LeapExt {
  constructor(
    readonly context: Context,
    readonly page: Page
  ) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}`);
  }

  async changeWallet(extensionId: string) {
    const newWalletName = await changeWallet(this.context, extensionId);

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
