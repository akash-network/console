import type { BrowserContext, Page } from "@playwright/test";
import { chromium } from "@playwright/test";
import { nanoid } from "nanoid";
import path from "path";

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
      `--load-extension=${pathToExtension}`,
      // Allow extension to make external API calls
      `--disable-web-security`,
      `--disable-features=IsolateOrigins,site-per-process`
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

      // Add route handler to mock failing Leap API calls if needed
      await extPage.route("**/api.leapwallet.io/**", async route => {
        const url = route.request().url();
        console.log(`Leap API call intercepted: ${url}`);

        // Try to fulfill the real request first
        try {
          await route.continue();
        } catch (error) {
          // If it fails, return empty but valid responses
          console.log(`Leap API call failed, returning mock: ${url}`);
          if (url.includes("/validators")) {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ validators: [] })
            });
          } else {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({})
            });
          }
        }
      });

      await extPage.goto(extUrl);
      await extPage.waitForLoadState("domcontentloaded");

      // Wait a bit for the extension to stabilize after initial load
      await extPage.waitForTimeout(2000);
    }

    await setupWallet(context, extPage);
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
