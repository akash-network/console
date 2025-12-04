import { netConfig } from "@akashnetwork/net";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import type { BrowserContext, Page } from "@playwright/test";
import { selectors } from "@playwright/test";
import fs from "fs";
import path from "path";
import { setTimeout as wait } from "timers/promises";

import { isWalletConnected } from "../uiState/isWalletConnected";
import { testEnvConfig } from "./test-env.config";
import { clickWalletSelectorDropdown } from "./testing-helpers";

const WALLET_PASSWORD = "12345678";

export async function getExtensionPage(context: BrowserContext, extensionId: string) {
  const extUrl = `chrome-extension://${extensionId}/index.html`;
  let extPage = context.pages().find(page => page.url().startsWith(extUrl));

  if (!extPage) {
    const newPagePromise = context.waitForEvent("page", { timeout: 5_000 }).catch(() => null);
    extPage = await context.newPage();
    await extPage.goto(extUrl);
    await extPage.waitForLoadState("domcontentloaded");
    await newPagePromise;
  }

  return extPage;
}

export async function setupWallet(page: Page) {
  const wallet = await importWalletToLeap(page, testEnvConfig.TEST_WALLET_MNEMONIC);
  await restoreExtensionStorage(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await topUpWallet(wallet);
}

export async function createWallet(
  context: BrowserContext,
  extensionId: string
): Promise<{
  extPage: Page;
  address: string;
}> {
  const extPage = await getExtensionPage(context, extensionId);

  await clickWalletSelectorDropdown(extPage);
  await extPage.getByRole("button", { name: /import wallet/i }).click();
  await extPage.getByRole("button", { name: /recovery phrase/i }).click();
  const tmpWallet = await DirectSecp256k1HdWallet.generate(12, { prefix: "akash" });
  await fillInMnemonic(extPage, tmpWallet.mnemonic);
  await extPage.getByRole("button", { name: /import wallet/i }).click();

  const accounts = await tmpWallet.getAccounts();

  return {
    extPage,
    address: accounts[0].address
  };
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

export async function awaitWalletAndApprove(context: BrowserContext, page: Page, extensionId: string) {
  const popupPage = await Promise.race([context.waitForEvent("page", { timeout: 5_000 }), getExtensionPage(context, extensionId)]);
  await approveWalletOperation(popupPage);
  await isWalletConnected(page);
}

export async function approveWalletOperation(popupPage: Page | null) {
  if (!popupPage) return;
  const buttonLocator = popupPage.locator("button", { hasText: /^\s*(Approve|Unlock wallet|Connect)\s*$/i });
  await buttonLocator.waitFor({ state: "visible", timeout: 5_000 });

  const buttonText = await buttonLocator.textContent();

  switch (buttonText?.trim()) {
    case "Approve": {
      // increase gas limit
      await popupPage.getByText(/show additional settings/i).click();
      const gasInput = popupPage
        .getByText("Enter gas limit manually")
        .locator("xpath=..") // get parent
        .locator("input");

      const value = Number(await gasInput.inputValue());
      await gasInput.fill(String(value + 20_000));
      await buttonLocator.click();
      break;
    }
    case "Unlock wallet":
      await popupPage.locator("input").fill(WALLET_PASSWORD);
      await buttonLocator.click();
      await popupPage
        .getByRole("button", { name: /Connect/i })
        .or(popupPage.getByLabel("wallet dropdown"))
        .click();
      break;
    case "Connect":
      await buttonLocator.click();
      break;
    default:
      throw new Error("Unexpected state in wallet popup");
  }
}

async function importWalletToLeap(page: Page, mnemonic: string) {
  await page.getByText(/import an existing wallet/i).click();
  await page.getByText(/recovery phrase/i).click();
  await fillInMnemonic(page, mnemonic);

  try {
    selectors.setTestIdAttribute("data-testing-id");

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

async function fillInMnemonic(page: Page, mnemonic: string) {
  const mnemonicArray = mnemonic.trim().split(" ");

  await page.locator('input[type="text"]:first-of-type').first().focus();

  for (const word of mnemonicArray) {
    await page.locator("input:focus").fill(word);
    await page.keyboard.press("Tab");
  }
}

export async function topUpWallet(wallet: DirectSecp256k1HdWallet) {
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

/**
 * To get the extension storage, follow these steps:
 * 1. Open Chrome with Leap extension installed
 * 2. Open DevTools (F12) on Leap extension page
 * 3. Run this in the script:
 *    ```js
 *    chrome.storage.local.get(null, (data) => {
 *      const json = JSON.stringify(data, null, 2);
 *      const blob = new Blob([json], {type: 'application/json'});
 *      const url = URL.createObjectURL(blob);
 *      const a = document.createElement('a');
 *      a.href = url;
 *      a.download = 'leapExtensionLocalStorage.json';
 *      a.click();
 *    });
 *    ```
 *
 * @see https://github.com/microsoft/playwright/issues/14949
 */
export async function restoreExtensionStorage(page: Page): Promise<void> {
  const extensionStorage = JSON.parse(fs.readFileSync(path.join(__dirname, "leapExtensionLocalStorage.json"), "utf8"));
  await page.evaluate(data => chrome.storage.local.set(data), extensionStorage);
}
