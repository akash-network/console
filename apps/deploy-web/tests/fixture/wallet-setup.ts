import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import type { BrowserContext, Page } from "@playwright/test";
import { selectors } from "@playwright/test";

import { restoreExtensionStorage } from "./context-with-extension";
import { testEnvConfig } from "./test-env.config";

const WALLET_PASSWORD = "12345678";

export async function setupWallet(context: BrowserContext, page: Page) {
  const wallet = await importWalletToLeap(context, page);
  await restoreExtensionStorage(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await topUpWallet(wallet);
}

export async function connectWalletViaLeap(context: BrowserContext, page: Page) {
  await page.getByTestId("connect-wallet-btn").click();
  const [, popupPage] = await Promise.all([
    page.getByRole("button", { name: "Leap Leap" }).click(),
    context.waitForEvent("page", { timeout: 1000 }).catch(() => null)
  ]);

  if (popupPage) {
    const buttonsSelector = ['button:has-text("Approve")', 'button:has-text("Unlock wallet")', 'button:has-text("Connect")'].join(",");

    await popupPage.waitForSelector(buttonsSelector, { state: "visible" });
    // sometimes wallet extension is flikering and "Unlock wallet" button is visible for a split second
    // so we need to wait again after a bit
    await popupPage.waitForTimeout(500);
    const visibleButton = await popupPage.waitForSelector(buttonsSelector, { state: "visible" });

    const buttonText = await visibleButton.textContent();
    switch (buttonText?.trim()) {
      case "Approve":
        await visibleButton.click();
        break;
      case "Unlock wallet":
        await popupPage.locator("input").fill(WALLET_PASSWORD);
        await visibleButton.click();
        break;
      case "Connect":
        await visibleButton.click();
        break;
      default:
        throw new Error("Unexpected state in wallet popup");
    }
  }

  await page.getByLabel("Connected wallet name and balance").waitFor({ state: "visible" });
}

async function importWalletToLeap(context: BrowserContext, page: Page) {
  const mnemonic = testEnvConfig.TEST_WALLET_MNEMONIC;
  if (!mnemonic) {
    throw new Error("TEST_WALLET_MNEMONIC is not set");
  }
  const mnemonicArray = mnemonic.trim().split(" ");

  if (mnemonicArray.length !== 12) {
    throw new Error("TEST_WALLET_MNEMONIC should have 12 words");
  }

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByText(/recovery phrase/i).click();

  try {
    selectors.setTestIdAttribute("data-testing-id");

    for (const word of mnemonicArray) {
      await page.locator("*:focus").fill(word);
      await page.keyboard.press("Tab");
    }

    await page.getByRole("button", { name: /Import/i }).click();

    // Select wallet
    await page.getByTestId("wallet-1").click();
    await page.getByTestId("btn-select-wallet-proceed").click();

    // Set password
    await page.getByTestId("input-password").fill(WALLET_PASSWORD);
    await page.getByTestId("input-confirm-password").fill(WALLET_PASSWORD);
    await page.getByTestId("btn-password-proceed").click();

    await page.waitForLoadState("domcontentloaded");

    return await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: "akash"
    });
  } finally {
    // Reset test id attribute for console
    selectors.setTestIdAttribute("data-testid");
  }
}

async function topUpWallet(wallet: DirectSecp256k1HdWallet) {
  try {
    const accounts = await wallet.getAccounts();
    const response = await fetch("https://faucet.sandbox-01.aksh.pw/faucet", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `address=${encodeURIComponent(accounts[0].address)}`
    });
    if (response.status >= 300) {
      console.error(`Unexpected faucet response status: ${response.status}`);
      console.error("Faucet response:", await response.text());
    }
  } catch (error) {
    console.error("Unable to top up wallet");
    console.error(error);
  }
}
