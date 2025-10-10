import { netConfig } from "@akashnetwork/net";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import type { BrowserContext, Page } from "@playwright/test";
import { selectors } from "@playwright/test";
import fs from "fs";
import path from "path";
import { setTimeout as wait } from "timers/promises";

import { isWalletConnected } from "../uiState/isWalletConnected";
import { testEnvConfig } from "./test-env.config";

const WALLET_PASSWORD = "12345678";

export async function setupWallet(context: BrowserContext, page: Page) {
  const wallet = await importWalletToLeap(context, page);
  await restoreExtensionStorage(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await topUpWallet(wallet);
}

export async function connectWalletViaLeap(context: BrowserContext, page: Page) {
  console.log("Connecting wallet via Leap extension");
  if (!(await isWalletConnected(page))) {
    await page.getByTestId("connect-wallet-btn").click();
    console.log("connect-wallet-btn clicked");

    // Wait a bit longer for the wallet selector to appear
    await wait(500);

    const popupPromise = context.waitForEvent("page", { timeout: 10_000 }).catch(() => null);

    await page.getByRole("button", { name: "Leap Leap" }).click();

    const popupPage = await popupPromise;
    console.log("popupPage opened: ", !!popupPage);

    if (popupPage) {
      // Wait for the popup to load - the new extension may take longer
      await popupPage.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {
        console.log("Popup page didn't reach domcontentloaded");
      });

      // Give it extra time to initialize
      await wait(2000);
    }

    await approveWalletOperation(popupPage);
    await isWalletConnected(page);
  }
}

export async function approveWalletOperation(popupPage: Page | null) {
  if (!popupPage) {
    console.log("No popup page provided to approveWalletOperation");
    return;
  }

  // Check if popup is already closed (newer extensions might auto-approve)
  if (popupPage.isClosed()) {
    console.log("Popup page already closed - connection may have been auto-approved");
    return;
  }

  const buttonsSelector = ['button:has-text("Approve")', 'button:has-text("Unlock wallet")', 'button:has-text("Connect")'].join(",");

  try {
    // Wait for button with shorter timeout - popup might close quickly
    await popupPage.waitForSelector(buttonsSelector, { state: "visible", timeout: 30_000 });

    // Check again if still open
    if (popupPage.isClosed()) {
      console.log("Popup closed while waiting for buttons");
      return;
    }

    // sometimes wallet extension is flickering and "Unlock wallet" button is visible for a split second
    // so we need to wait again after a bit
    await popupPage.waitForTimeout(500);

    // Check one more time before trying to interact
    if (popupPage.isClosed()) {
      console.log("Popup closed after timeout");
      return;
    }

    const visibleButton = await popupPage.waitForSelector(buttonsSelector, { state: "visible", timeout: 3000 });
    const buttonText = await visibleButton.textContent();

    switch (buttonText?.trim()) {
      case "Approve":
        await visibleButton.click();
        console.log("Clicked Approve button");
        break;
      case "Unlock wallet":
        await popupPage.locator("input").fill(WALLET_PASSWORD);
        await visibleButton.click();
        console.log("Unlocked wallet and clicked button");
        break;
      case "Connect":
        await visibleButton.click();
        console.log("Clicked Connect button");
        break;
      default:
        console.log(`Unexpected button text: ${buttonText}`);
        throw new Error("Unexpected state in wallet popup");
    }
  } catch (error) {
    if (popupPage.isClosed()) {
      console.log("Popup was closed during operation - this might be normal for the new extension");
      return;
    }
    console.error("Error in approveWalletOperation:", error);
    throw error;
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
  await page.getByText(/import recovery phrase/i).click();

  try {
    selectors.setTestIdAttribute("data-testing-id");

    const mnemonicInputs = page.locator("input");

    // Fill mnemonic words
    await mnemonicInputs.first().click();

    for (const word of mnemonicArray) {
      await page.locator("*:focus").fill(word);
      await page.keyboard.press("Tab");
    }

    await page.getByRole("button", { name: /Continue/i }).click();

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
