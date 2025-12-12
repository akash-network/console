import type { BrowserContext, Page } from "@playwright/test";
import { chromium } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import JSZip from "jszip";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "path";

import { selectChainNetwork } from "../actions/selectChainNetwork";
import { PATH_TO_EXTENSION } from "../fixture/context-with-extension";
import { testEnvConfig } from "../fixture/test-env.config";
import { connectWalletViaLeap, getExtensionPage, importWalletToLeap, topUpWallet } from "../fixture/wallet-setup";
import { isWalletConnected } from "../uiState/isWalletConnected";

const LEAP_VERSION = "0.23.1";
const PATH_TO_EXTENSION_ZIP = path.join(__dirname, "chrome-extensions", `Leap-${LEAP_VERSION}.zip`);

export default async () => {
  console.log("1. Unarchive Leap chrome extension...");

  await mkdir(PATH_TO_EXTENSION, { recursive: true });
  const extensionBuffer = await readFile(PATH_TO_EXTENSION_ZIP);
  const zip = new JSZip();
  await zip.loadAsync(extensionBuffer);
  for (const file of Object.values(zip.files)) {
    if (file.dir) {
      await mkdir(path.join(PATH_TO_EXTENSION, file.name), { recursive: true });
      continue;
    }

    await pipeline(file.nodeStream(), createWriteStream(path.join(PATH_TO_EXTENSION, file.name)));
  }
  console.log("✅ Leap chrome extension unarchived");

  console.log("2. Launching Chrome with Leap extension...");
  const args = [
    // keep new line
    `--disable-extensions-except=${PATH_TO_EXTENSION}`,
    `--load-extension=${PATH_TO_EXTENSION}`
  ];

  await rm(testEnvConfig.USER_DATA_DIR, { recursive: true, force: true });
  const context = await chromium.launchPersistentContext(testEnvConfig.USER_DATA_DIR, {
    channel: "chromium",
    args,
    headless: !!process.env.CI,
    permissions: ["clipboard-read", "clipboard-write"]
  });

  const extPage = await context.waitForEvent("page", { timeout: 5_000 }).catch(() => getExtensionPage(context));
  console.log("✅ Chrome with Leap extension launched");

  console.log("3. Importing test wallet to Leap and top up...");
  const wallet = await importWalletToLeap(extPage, testEnvConfig.TEST_WALLET_MNEMONIC);
  const accounts = await wallet.getAccounts();
  const address = accounts[0].address;
  await topUpWallet(address);
  await extPage.waitForLoadState("load");
  console.log("✅ Wallet imported and topped up");

  console.log(`4. Switching to ${testEnvConfig.NETWORK_ID} network...`);
  const page = await context.newPage();
  await switchToChainNetwork(context, page);
  console.log("✅ Chain network switched");

  console.log("5. Saving extension state...");
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

  await extPage.close();
  await page.close();
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
