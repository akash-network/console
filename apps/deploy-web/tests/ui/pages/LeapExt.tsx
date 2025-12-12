import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import type { BrowserContext, Page } from "@playwright/test";

import { wait } from "@src/utils/timer";
import { testEnvConfig } from "../fixture/test-env.config";
import { clickConnectWalletButton, clickWalletSelectorDropdown } from "../fixture/testing-helpers";
import { createWallet, getExtensionPage } from "../fixture/wallet-setup";

export type FeeType = "low" | "medium" | "high";
export class LeapExt {
  constructor(
    readonly context: BrowserContext,
    readonly page: Page
  ) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}`);
  }

  async createAndUseWallet(): Promise<string> {
    const { extPage, address } = await createWallet(this.context);

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

  async switchToTestWallet(): Promise<void> {
    const extPage = await getExtensionPage(this.context);
    await clickWalletSelectorDropdown(extPage);
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(testEnvConfig.TEST_WALLET_MNEMONIC, {
      prefix: "akash"
    });
    const accounts = await wallet.getAccounts();
    await extPage.getByPlaceholder(/Search by wallet name or address/i).fill(accounts[0].address);
    await extPage
      .getByText(/Wallet\s+1/i)
      .filter({ visible: true })
      .click();
    await extPage.getByLabel("wallet name").waitFor({ state: "visible" });
    await extPage.close();
  }

  async disconnectWallet() {
    await this.page.getByLabel("Connected wallet name and balance").hover();
    await this.page.getByRole("button", { name: "Disconnect Wallet" }).click();

    await this.page.reload({ waitUntil: "networkidle" });
  }

  async acceptTransaction(feeType: FeeType = "low"): Promise<void> {
    const popupPage = await this.context.waitForEvent("page");
    await popupPage.waitForLoadState("load");
    const feeTypeLocator = getFeeTypeLocator(popupPage, feeType);
    const feeTypeLabelLocator = feeTypeLocator.locator("xpath=..");
    await feeTypeLabelLocator.click();

    await popupPage.getByText(/show additional settings/i).click();
    const gasInput = popupPage
      .getByText("Enter gas limit manually")
      .locator("xpath=..") // get parent
      .locator("input");

    const value = Number(await gasInput.inputValue());
    await gasInput.fill(Math.ceil(1.5 * value).toString());

    if (!(await feeTypeLocator.isChecked())) {
      // sometimes leap wallet reverts fee type back to low
      await feeTypeLabelLocator.click();
    }

    await Promise.all([popupPage.waitForEvent("close"), popupPage.locator("button", { hasText: /Approve/i }).click()]);
  }

  async waitForTransaction(type: "success" | "error"): Promise<void> {
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
  }
}

function getFeeTypeLocator(page: Page, feeType: FeeType) {
  return page.locator(`input[name="fee"][type="radio"][value="${feeType}"]`);
}
