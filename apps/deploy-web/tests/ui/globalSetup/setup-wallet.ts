import { chromium } from "@playwright/test";
import { rm } from "fs/promises";
import path from "path";

import { testEnvConfig } from "../fixture/test-env.config";
import { getExtensionPage, setupWallet } from "../fixture/wallet-setup";

export default async () => {
  const pathToExtension = path.join(__dirname, "..", "fixture", "Leap");
  const args = [
    // keep new line
    `--disable-extensions-except=${pathToExtension}`,
    `--load-extension=${pathToExtension}`
  ];

  console.log("Configuring user data directory for tests");
  await rm(testEnvConfig.USER_DATA_DIR, { recursive: true, force: true });
  const context = await chromium.launchPersistentContext(testEnvConfig.USER_DATA_DIR, {
    channel: "chromium",
    args,
    headless: process.env.CI === "true",
    permissions: ["clipboard-read", "clipboard-write"]
  });

  let [background] = context.serviceWorkers();
  if (!background) {
    background = await context.waitForEvent("serviceworker");
  }

  const extensionId = background.url().split("/")[2];
  if (!extensionId) {
    throw new Error("Wallet extension id cannot be determined");
  }
  console.log("Detected wallet extension id", extensionId);
  const extPage = await getExtensionPage(context, extensionId);
  console.log("Importing test wallet to Leap and top up...");

  try {
    await setupWallet(extPage);
  } catch (error) {
    console.error("❌ Error setting up wallet. Retrying...", error);
    await extPage.reload({ waitUntil: "load" });
    await setupWallet(extPage);
  }

  console.log("🚀🚀🚀 Wallet setup complete");

  await context.close();
};
