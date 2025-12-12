import type { NetworkId } from "@akashnetwork/chain-sdk";
import { netConfig } from "@akashnetwork/net";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import type { BrowserContext, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { setTimeout as wait } from "timers/promises";

import { isWalletConnected } from "../uiState/isWalletConnected";
import { testEnvConfig } from "./test-env.config";
import { clickWalletSelectorDropdown } from "./testing-helpers";

const WALLET_PASSWORD = "12345678";

export async function getExtensionPage(context: BrowserContext): Promise<Page> {
  const extensionId = await getExtensionId(context);
  const extUrl = `chrome-extension://${extensionId}`;
  const extPage = context.pages().find(page => page.url().startsWith(extUrl));

  if (!extPage) {
    const page = await context.newPage();
    await page.goto(`${extUrl}/index.html`, { waitUntil: "domcontentloaded" });
    return page;
  }

  return extPage;
}

let extensionId: string | undefined;
export async function getExtensionId(context: BrowserContext): Promise<string> {
  if (extensionId) return extensionId;

  let [background] = context.serviceWorkers();
  if (!background) {
    background = await context.waitForEvent("serviceworker");
  }

  extensionId = background.url().split("/")[2];
  return extensionId;
}

export async function setupWallet(page: Page) {
  const address = await restoreExtensionStorage(page, testEnvConfig.NETWORK_ID);
  await topUpWallet(address);
}

export async function createWallet(context: BrowserContext): Promise<{
  extPage: Page;
  address: string;
}> {
  const extPage = await getExtensionPage(context);
  await extPage.waitForLoadState("load");

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
      context.waitForEvent("page", { timeout: 15_000 }).catch(() => null),
      wait(100).then(() => page.getByRole("button", { name: "Leap Leap" }).click())
    ]);

    if (popupPage) await connectOrUnlockWallet(popupPage);
    await isWalletConnected(page);
  }
}

async function connectOrUnlockWallet(popupPage: Page) {
  const buttonLocator = popupPage
    .getByRole("button", { name: /Unlock wallet/i })
    .or(popupPage.getByRole("button", { name: /connect button in approve connection flow/i }));
  const buttonText = (await buttonLocator.textContent())?.trim();
  if (buttonText === "Unlock wallet") {
    await unlockWallet(popupPage);
  } else if (buttonText === "Connect") {
    await buttonLocator.click();
  } else {
    throw new Error(`Unexpected state in wallet popup: ${buttonText}`);
  }
}

export async function awaitWalletAndApprove(context: BrowserContext, page: Page) {
  const popupPage = await Promise.race([context.waitForEvent("page", { timeout: 5_000 }), getExtensionPage(context)]);
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
      await gasInput.fill(Math.ceil(1.5 * value).toString());
      await buttonLocator.click();
      break;
    }
    case "Unlock wallet":
      await unlockWallet(popupPage);
      await popupPage
        .getByRole("button", { name: /connect button in approve connection flow/i })
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

export async function unlockWallet(page: Page) {
  await page.locator("input").fill(WALLET_PASSWORD);
  await page.getByRole("button", { name: /unlock wallet/i }).click();
}

export async function importWalletToLeap(page: Page, mnemonic: string) {
  await page.getByText(/import an existing wallet/i).click();
  await page.getByText(/recovery phrase/i).click();
  await fillInMnemonic(page, mnemonic);

  await page.getByRole("button", { name: /Continue/i }).click();
  await page.waitForTimeout(2000);
  await page.getByRole("checkbox", { name: "Wallet 1" }).setChecked(true);
  await page.getByRole("button", { name: /Proceed/i }).click();

  // Set password
  await page.getByPlaceholder("Enter password").fill(WALLET_PASSWORD);
  await page.getByPlaceholder("Confirm password").fill(WALLET_PASSWORD);
  await page.locator("button", { hasText: /Set Password/i }).click();

  await page.waitForLoadState("domcontentloaded");

  return await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: "akash"
  });
}

async function fillInMnemonic(page: Page, mnemonic: string) {
  const mnemonicArray = mnemonic.trim().split(" ");

  await page.locator('input[type="text"]:first-of-type').first().focus();

  for (const word of mnemonicArray) {
    await page.locator("input:focus").fill(word);
    await page.keyboard.press("Tab");
  }
}

export async function topUpWallet(address: string, attempt = 0) {
  try {
    const balance = await getBalance(address);

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
      body: `address=${encodeURIComponent(address)}`
    });
    if (response.status >= 300) {
      const error = await response.text();
      console.error(`Unexpected faucet response status: ${response.status}`);
      console.error(error);

      if (error.includes("account sequence mismatch") && attempt < 10) {
        console.log("retrying top up attempt...", attempt + 1);
        await wait(2000);
        await topUpWallet(address, attempt + 1);
        return;
      }
    }
  } catch (error) {
    console.error("Unable to top up wallet");
    console.error(error);
  }
}

async function getBalance(address: string) {
  const response = await fetch(`${netConfig.getBaseAPIUrl(testEnvConfig.NETWORK_ID)}/cosmos/bank/v1beta1/balances/${address}`);
  const data = await response.json();
  if (!response.ok) return 0;
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
export async function restoreExtensionStorage(page: Page, networkId: NetworkId): Promise<string> {
  const extensionStorage = JSON.parse(fs.readFileSync(path.join(__dirname, `leapExtensionLocalStorage.${networkId}.json`), "utf8"));
  await page.evaluate(data => chrome.storage.local.set(data), extensionStorage);
  return extensionStorage["active-wallet"].addresses.akash;
}
