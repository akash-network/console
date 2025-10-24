import { netConfig } from "@akashnetwork/net";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import type { BrowserContext, Page } from "@playwright/test";
import { selectors } from "@playwright/test";
import fs from "fs";
import path from "path";
import { setTimeout as wait } from "timers/promises";

import { isWalletConnected } from "../uiState/isWalletConnected";
import { testEnvConfig } from "./test-env.config";
import { clickCreateNewWalletButton, clickCreateWalletButton, clickWalletSelectorDropdown, fillWalletName } from "./testing-helpers";

const WALLET_PASSWORD = "12345678";

export async function getExtensionPage(context: BrowserContext, extensionId: string) {
  const extUrl = `chrome-extension://${extensionId}/index.html`;
  let extPage = context.pages().find(page => page.url().startsWith(extUrl));

  if (!extPage) {
    extPage = await context.newPage();
    await extPage.goto(extUrl);
    await extPage.waitForLoadState("domcontentloaded");
    await context.waitForEvent("page", { timeout: 5_000 }).catch(() => null);
  }

  return extPage;
}

export async function setupWallet(context: BrowserContext, page: Page) {
  const wallet = await importWalletToLeap(context, page);
  await restoreExtensionStorage(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await topUpWallet(wallet);
}

export async function createWallet(context: BrowserContext, extensionId: string, walletName: string) {
  const extPage = await getExtensionPage(context, extensionId);

  await clickWalletSelectorDropdown(extPage);
  await clickCreateNewWalletButton(extPage);
  await fillWalletName(extPage, walletName);

  return clickCreateWalletButton(extPage);
}

export async function connectWalletViaLeap(context: BrowserContext, page: Page) {
  if (!(await isWalletConnected(page))) {
    await page.getByTestId("connect-wallet-btn").click();
    const [popupPage] = await Promise.all([
      context.waitForEvent("page", { timeout: 5_000 }).catch(() => null),
      wait(100).then(() => page.getByRole("button", { name: "Leap Leap" }).click())
    ]);

    await approveWalletOperation(popupPage);
    await isWalletConnected(page);
  }
}

export async function awaitWalletAndApprove(context: BrowserContext, page: Page) {
  const popupPage = await context.waitForEvent("page", { timeout: 5_000 });
  await approveWalletOperation(popupPage);
  await isWalletConnected(page);
}

export async function approveWalletOperation(popupPage: Page | null) {
  if (!popupPage) return;
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
      await popupPage.waitForSelector('button:has-text("Connect")', { state: "visible" }).then(button => button.click());
      break;
    case "Connect":
      await visibleButton.click();
      break;
    default:
      throw new Error("Unexpected state in wallet popup");
  }
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

  await page.getByText(/import an existing wallet/i).click();
  await page.getByText(/recovery phrase/i).click();

  try {
    selectors.setTestIdAttribute("data-testing-id");

    for (const word of mnemonicArray) {
      await page.locator("input:focus").fill(word);
      await page.keyboard.press("Tab");
    }

    await page.getByRole("button", { name: /Continue/i }).click();
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
    const balance = await getBalance(accounts[0].address);

    if (balance > 100 * 1_000_000) {
      // 100 AKT should be enough
      return;
    }

    let faucetUrl = netConfig.getFaucetUrl(testEnvConfig.NETWORK_ID);
    if (!faucetUrl) {
      console.error(`Faucet URL is not set for this network: ${testEnvConfig.NETWORK_ID}. Cannot auto top up wallet`);
      return;
    }

    if (faucetUrl.endsWith("/")) {
      faucetUrl = faucetUrl.slice(0, -1);
    }

    const response = await fetch(`${faucetUrl}/faucet`, {
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

async function getBalance(address: string) {
  const response = await fetch(`${netConfig.getBaseAPIUrl(testEnvConfig.NETWORK_ID)}/cosmos/bank/v1beta1/balances/${address}`);
  const data = await response.json();
  return data.balances.find((balance: Record<string, string>) => balance.denom === "uakt")?.amount || 0;
}

// @see https://github.com/microsoft/playwright/issues/14949
export async function restoreExtensionStorage(page: Page): Promise<void> {
  const extensionStorage = JSON.parse(fs.readFileSync(path.join(__dirname, "leapExtensionLocalStorage.json"), "utf8"));
  await page.evaluate(data => chrome.storage.local.set(data), extensionStorage);
}
