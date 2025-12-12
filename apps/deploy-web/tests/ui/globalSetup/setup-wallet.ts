import type { BrowserContext, Page } from "@playwright/test";
import { chromium } from "@playwright/test";
import { rm, writeFile } from "fs/promises";
import path from "path";

import { selectChainNetwork } from "../actions/selectChainNetwork";
import { testEnvConfig } from "../fixture/test-env.config";
import { connectWalletViaLeap, getExtensionPage, importWalletToLeap, setupWallet, topUpWallet } from "../fixture/wallet-setup";
import { isWalletConnected } from "../uiState/isWalletConnected";

export default async () => {
  const pathToExtension = path.join(__dirname, "..", "fixture", "Leap");
  const args = [
    // keep new line
    `--disable-extensions-except=${pathToExtension}`,
    `--load-extension=${pathToExtension}`
  ];

  await rm(testEnvConfig.USER_DATA_DIR, { recursive: true, force: true });
  const context = await chromium.launchPersistentContext(testEnvConfig.USER_DATA_DIR, {
    channel: "chromium",
    args,
    headless: !!process.env.CI,
    permissions: ["clipboard-read", "clipboard-write"]
  });

  const extPage = await context.waitForEvent("page", { timeout: 5_000 }).catch(() => getExtensionPage(context));

  try {
    console.log("1. Importing test wallet to Leap and top up...");
    const wallet = await importWalletToLeap(extPage, testEnvConfig.TEST_WALLET_MNEMONIC);
    const accounts = await wallet.getAccounts();
    const address = accounts[0].address;
    await topUpWallet(address);
    await extPage.waitForLoadState("load");
    console.log("✅ Wallet imported and topped up");

    console.log("2. Switching to chain network...");
    const page = await context.newPage();
    await switchToChainNetwork(context, page);
    console.log("✅ Chain network switched");

    console.log("3. Saving extension state...");
    await extPage.reload({ waitUntil: "load" });
    const storageState = await extPage.evaluate<string>(() => {
      return new Promise(resolve => {
        chrome.storage.local.get(null, (data: any) => {
          const json = JSON.stringify(data, null, 2);
          resolve(json);
        });
      });
    });
    const extStatePath = path.join(__dirname, "..", "fixture", `leapExtensionLocalStorage.${testEnvConfig.NETWORK_ID}.json`);
    await writeFile(extStatePath, storageState);
    console.log(`✅ Extension state saved to ${extStatePath}`);
    console.log("🚀🚀🚀 Wallet setup complete");
  } catch (error) {
    console.error("❌ Error setting up wallet. Retrying...", error);
    await extPage.reload({ waitUntil: "load" });
    await setupWallet(extPage);
  }

  await context.close();
};

async function switchToChainNetwork(context: BrowserContext, page: Page, attempt = 0) {
  await page.goto(testEnvConfig.BASE_URL, { waitUntil: "load" });
  await connectWalletViaLeap(context, page);
  if (await isWalletConnected(page)) {
    await selectChainNetwork(page, testEnvConfig.NETWORK_ID);
    await connectWalletViaLeap(context, page);
  } else if (attempt < 3) {
    await switchToChainNetwork(context, page, attempt + 1);
  } else {
    throw new Error("Failed to switch to chain network after 3 attempts wallet has not been connected");
  }
}
