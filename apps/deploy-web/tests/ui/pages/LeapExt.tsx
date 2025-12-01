import type { BrowserContext, Page } from "@playwright/test";

import { wait } from "@src/utils/timer";
import { testEnvConfig } from "../fixture/test-env.config";
import { clickConnectWalletButton } from "../fixture/testing-helpers";
import { approveWalletOperation, createWallet } from "../fixture/wallet-setup";

export type FeeType = "low" | "medium" | "high";
export class LeapExt {
  constructor(
    readonly context: BrowserContext,
    readonly page: Page
  ) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}`);
  }

  async createWallet(extensionId: string): Promise<string> {
    const { extPage, address } = await createWallet(this.context, extensionId);

    const [popup] = await Promise.all([
      this.context.waitForEvent("page"),
      wait(100).then(() => {
        this.page.reload({ waitUntil: "domcontentloaded" });
      })
    ]);
    await clickConnectWalletButton(popup);
    await extPage.close();

    return address;
  }

  async disconnectWallet() {
    await this.page.getByLabel("Connected wallet name and balance").hover();
    await this.page.getByRole("button", { name: "Disconnect Wallet" }).click();

    await this.page.reload({ waitUntil: "networkidle" });
  }

  async acceptTransaction(context: BrowserContext, feeType: FeeType = "low") {
    const popupPage = await context.waitForEvent("page", { timeout: 5_000 });
    const feeTypeLocator = getFeeTypeLocator(popupPage, feeType);
    await feeTypeLocator.waitFor({ state: "visible" });
    await feeTypeLocator.click();
    await approveWalletOperation(popupPage);
    await this.page.waitForLoadState("networkidle");
  }

  async waitForTransaction(type: "success" | "error") {
    const text = type === "success" ? /Transaction success/i : /Transaction has failed/i;
    await this.page.getByText(text).waitFor({ state: "visible", timeout: 20_000 });
  }
}

function getFeeTypeLocator(page: Page, feeType: FeeType) {
  return page.locator(`input[name="fee"][type="radio"][value="${feeType}"]`);
}
