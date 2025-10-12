import type { BrowserContext, Page } from "@playwright/test";
import { chromium } from "@playwright/test";
import { nanoid } from "nanoid";
import path from "path";
import { setTimeout as wait } from "timers/promises";

import { selectChainNetwork } from "../actions/selectChainNetwork";
import { injectUIConfig, test as baseTest } from "./base-test";
import { testEnvConfig } from "./test-env.config";
import { connectWalletViaLeap, setupWallet } from "./wallet-setup";

// @see https://playwright.dev/docs/chrome-extensions
export const test = baseTest.extend<{
  context: BrowserContext;
  extensionId: string;
  extPage: Page;
}>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const pathToExtension = path.join(__dirname, "Leap");
    const contextName = nanoid();
    const userDataDir = path.join(__dirname, "testdata", "tmp", contextName);
    const args = [
      // keep new line
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`
    ];

    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      args,
      // Grant permissions needed by the extension
      permissions: ["clipboard-read", "clipboard-write"],
      // Bypass CSP to allow API calls
      bypassCSP: true
    });

    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent("serviceworker");
    }

    const extensionId = background.url().split("/")[2];
    await use(extensionId);
  },
  page: async ({ context, extensionId }, use) => {
    try {
      await context.waitForEvent("page", { timeout: 5000 });
    } catch {
      // ignore timeout error
    }

    const extUrl = `chrome-extension://${extensionId}/index.html`;
    let extPage = context.pages().find(page => page.url().startsWith(extUrl));

    if (!extPage) {
      extPage = await context.newPage();

      await extPage.goto(extUrl, { waitUntil: "domcontentloaded" });
      await wait(2000);
    }

    await setupWallet(context, extPage);

    // Check if we're on the success screen and need to close/reopen
    const getStartedButton = extPage.getByRole("button", { name: /get started/i });
    if (await getStartedButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("Found 'Get started' button - closing and reopening extension");
      await extPage.close();
      await wait(2000);

      // Reopen the extension
      extPage = await context.newPage();
      await extPage.goto(extUrl, { waitUntil: "domcontentloaded" });
      await wait(2000);
    }

    await extPage.locator("input").fill("12345678");
    await wait(2000);
    await extPage.locator('button:has-text("Unlock wallet")').click();
    await wait(2000);

    await extPage.close();
    const page = await context.newPage();
    await injectUIConfig(page);

    if (testEnvConfig.NETWORK_ID !== "mainnet") {
      await page.goto(testEnvConfig.BASE_URL);
      await connectWalletViaLeap(context, page);
      await selectChainNetwork(page, testEnvConfig.NETWORK_ID);
      await connectWalletViaLeap(context, page);
    }

    await use(page);
  }
});

export const expect = test.expect;

export interface ExtensionContext {
  context: BrowserContext;
  page: Page;
  extensionId: string;
}

declare global {
  const chrome: any;
}
