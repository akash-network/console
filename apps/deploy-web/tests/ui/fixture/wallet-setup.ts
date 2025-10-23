import { netConfig } from "@akashnetwork/net";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import type { BrowserContext, Page } from "@playwright/test";
import { selectors } from "@playwright/test";
import fs from "fs";
import path from "path";
import { setTimeout as wait } from "timers/promises";

import { isWalletConnected } from "../uiState/isWalletConnected";
import { testEnvConfig } from "./test-env.config";
import { getCurrentWalletName, selectDifferentWallet } from "./testing-helpers";

const WALLET_PASSWORD = "12345678";

export async function fillWalletPassword(page: Page) {
  selectors.setTestIdAttribute("data-testing-id");

  const [passwordInput, confirmPasswordInput, proceedButton] = await Promise.all([
    page.getByTestId("input-password").or(page.getByTestId("login-input-enter-password")).first(),
    page.getByTestId("input-confirm-password"),
    page.getByTestId("btn-password-proceed").or(page.getByTestId("btn-unlock-wallet")).first()
  ]);

  if (!(await passwordInput.isVisible({ timeout: 3_000 }).catch(() => false))) {
    return;
  }

  await proceedButton.waitFor({ state: "visible", timeout: 10_000 });

  await passwordInput.fill(WALLET_PASSWORD);

  if (await confirmPasswordInput.isVisible().catch(() => false)) {
    await confirmPasswordInput.fill(WALLET_PASSWORD);
  }

  selectors.setTestIdAttribute("data-testid");

  return await proceedButton.click();
}

export async function getExtensionPageAndUrl(context: BrowserContext, extensionId: string) {
  const extUrl = `chrome-extension://${extensionId}/index.html`;
  let extPage = context.pages().find(page => page.url().startsWith(extUrl));

  if (!extPage) {
    extPage = await context.newPage();
    await extPage.goto(extUrl);
    await extPage.waitForLoadState("domcontentloaded");
    await context.waitForEvent("page", { timeout: 5_000 }).catch(() => null);
  }

  return {
    page: extPage,
    url: extUrl
  };
}

export async function setupWallet(context: BrowserContext, page: Page) {
  const wallet = await importWalletToLeap(context, page);
  await restoreExtensionStorage(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await topUpWallet(wallet);
}

export async function changeWallet(context: BrowserContext, extensionId: string) {
  const { page: extPage } = await getExtensionPageAndUrl(context, extensionId);
  const currentWalletName = await getCurrentWalletName(extPage);
  await extPage.getByText(currentWalletName).click();
  return await selectDifferentWallet(extPage, currentWalletName);
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
  const mnemonicWords = mnemonic.trim().split(" ");

  try {
    selectors.setTestIdAttribute("data-testing-id");

    await page.getByText("Import an existing wallet").click();
    await wait(1000);

    const recoveryPhraseButton = page.getByText(/recovery phrase|secret phrase/i);
    if (await recoveryPhraseButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await recoveryPhraseButton.click();
    }

    for (let i = 0; i < mnemonicWords.length; i++) {
      const word = mnemonicWords[i];
      const focusedInput = await page.$$("#popup-layout input");

      // console.log("focusedInput:", await focusedInput.count());

      if (await focusedInput[i].isVisible().catch(() => false)) {
        await focusedInput[i].fill(word);
        await page.keyboard.press("Tab");
      }
    }

    const importButton = page.getByRole("button", { name: /continue/i });
    await importButton.click();

    await page.waitForSelector('[data-testing-id^="wallet-"]', { state: "visible", timeout: 10000 });

    const allWallets = await page.locator('[data-testing-id^="wallet-"]').all();

    if (allWallets.length < 2) {
      throw new Error(`Not enough wallets to select. Found: ${allWallets.length}, need at least 2`);
    }

    for (let i = 0; i < Math.min(2, allWallets.length); i++) {
      const wallet = allWallets[i];

      const isChecked = await wallet.getByRole("checkbox").getAttribute("aria-checked");

      if (isChecked === "true") {
        continue;
      }

      await wallet.click({ force: true });
    }

    await page.getByTestId("btn-select-wallet-proceed").click();

    await page.getByTestId("input-password").fill(WALLET_PASSWORD);
    await page.getByTestId("input-confirm-password").fill(WALLET_PASSWORD);
    await page.getByTestId("btn-password-proceed").click();

    await wait(5000);

    const getStartedButton = page.getByRole("button", { name: /get started/i });

    await getStartedButton.isVisible({ timeout: 3000 }).catch(() => false);

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
  const extensionStorage = JSON.parse(fs.readFileSync(path.join(__dirname, "leap-extension-local-storage.json"), "utf8"));
  await page.evaluate(data => chrome.storage.local.set(data), extensionStorage);
}
