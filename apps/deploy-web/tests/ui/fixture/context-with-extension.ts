import type { BrowserContext, Page } from "@playwright/test";
import { chromium } from "@playwright/test";
import { nanoid } from "nanoid";
import path from "path";

import { selectChainNetwork } from "../actions/selectChainNetwork";
import { injectUIConfig, test as baseTest } from "./base-test";
import { testEnvConfig } from "./test-env.config";
import { awaitWalletAndApprove, connectWalletViaLeap, getExtensionPage, setupWallet } from "./wallet-setup";

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
      permissions: ["clipboard-read", "clipboard-write"]
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
  page: [
    async ({ context, extensionId }, use) => {
      try {
        await context.waitForEvent("page", { timeout: 5000 });
      } catch {
        // ignore timeout error
      }

      const extPage = await getExtensionPage(context, extensionId);

      await setupWallet(context, extPage);
      await extPage.close();
      const page = await context.newPage();
      await injectUIConfig(page);

      if (testEnvConfig.NETWORK_ID !== "mainnet") {
        try {
          await page.goto(testEnvConfig.BASE_URL);
          await connectWalletViaLeap(context, page);
          await selectChainNetwork(page, testEnvConfig.NETWORK_ID);
          await connectWalletViaLeap(context, page);
        } catch {
          // Fallback in case the default network is non-functional.
          //  E.g., during network upgrade when sandbox is already on a different version from mainnet
          await page.goto(`${testEnvConfig.BASE_URL}?network=${testEnvConfig.NETWORK_ID}`);
          await awaitWalletAndApprove(context, page);
        }
      }

      await use(page);
    },
    { scope: "test", timeout: 5 * 60 * 1000 }
  ]
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
