import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import type { BrowserContext, Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";
import { topUpWallet } from "../fixture/wallet-setup";
import type { FeeType } from "../fixture/web-wallet/injectWebWallet";
import { setFeeType, switchWebWallet } from "../fixture/web-wallet/injectWebWallet";

export class WebWallet {
  constructor(
    readonly context: BrowserContext,
    readonly page: Page
  ) {}

  async goto() {}

  async switchToNewWallet(): Promise<string> {
    const tmpWallet = await DirectSecp256k1HdWallet.generate(12, { prefix: "akash" });
    const [account] = await tmpWallet.getAccounts();
    await topUpWallet(account.address);
    await switchWebWallet(this.page, tmpWallet.mnemonic);
    return account.address;
  }

  async switchToTestWallet(): Promise<void> {
    await switchWebWallet(this.page, testEnvConfig.TEST_WALLET_MNEMONIC);
  }

  async disconnectWallet() {
    await this.page.getByLabel("Connected wallet name and balance").hover();
    await this.page.getByRole("button", { name: "Disconnect Wallet" }).click();
    await this.page.reload({ waitUntil: "networkidle" });
  }

  acceptTransaction(feeType: FeeType = "low") {
    setFeeType(this.page, feeType);
  }

  async waitForTransaction(type: "success" | "error"): Promise<void> {
    await this.getTransaction(type);
  }

  async getTransaction(type: "success" | "error"): Promise<{
    type: "success" | "error";
    text: string;
    close: () => Promise<void>;
  }> {
    const MESSAGES = {
      success: /Transaction success/i,
      error: /Transaction has failed/i
    };
    const resultLocator = this.page
      .locator('[role="alert"]', { hasText: MESSAGES.success })
      .or(this.page.locator('[role="alert"]', { hasText: MESSAGES.error }));
    const text = await resultLocator.textContent({ timeout: 25_000 });

    if (!text || !MESSAGES[type].test(text)) {
      throw new Error(`Expected transaction "${type}" but got "${text}"`);
    }

    return {
      type,
      text,
      close: () => resultLocator.getByRole("button").click()
    };
  }
}
