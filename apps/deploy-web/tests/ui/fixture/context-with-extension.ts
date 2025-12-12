import type { BrowserContext, Page } from "@playwright/test";
import { chromium } from "@playwright/test";
import path from "path";

import { selectChainNetwork } from "../actions/selectChainNetwork";
import { injectUIConfig, test as baseTest } from "./base-test";
import { testEnvConfig } from "./test-env.config";
import { awaitWalletAndApprove, connectWalletViaLeap, getExtensionPage, setupWallet } from "./wallet-setup";

// @see https://playwright.dev/docs/chrome-extensions
export const test = baseTest.extend<ExtensionContext>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const pathToExtension = path.join(__dirname, "Leap");
    const args = [
      // keep new line
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`
    ];

    const userDataDirForTest = `${testEnvConfig.USER_DATA_DIR}-${crypto.randomUUID()}`;
    const context = await chromium.launchPersistentContext(userDataDirForTest, {
      channel: "chromium",
      args,
      permissions: ["clipboard-read", "clipboard-write"]
    });

    try {
      await use(context);
    } finally {
      await context.close();
    }
  },
  page: [
    async ({ context }, use) => {
      const extPage = await context.waitForEvent("page", { timeout: 2_000 }).catch(() => getExtensionPage(context));
      await setupWallet(extPage);
      const [page] = await Promise.all([context.newPage(), extPage.close()]);
      await injectUIConfig(page);

      if (testEnvConfig.NETWORK_ID !== "mainnet") {
        try {
          await page.goto(testEnvConfig.BASE_URL);
          await connectWalletViaLeap(context, page);
          await selectChainNetwork(page, testEnvConfig.NETWORK_ID);
          await connectWalletViaLeap(context, page);
        } catch (error) {
          console.log("the default network is non-functional, uses fallback");
          console.error(error);
          // Fallback in case the default network is non-functional.
          //  E.g., during network upgrade when sandbox is already on a different version from mainnet
          await page.goto(`${testEnvConfig.BASE_URL}?network=${testEnvConfig.NETWORK_ID}`);
          await awaitWalletAndApprove(context, page);
        }
      }

      try {
        await use(page);
      } finally {
        await page.evaluate(() => {
          localStorage.clear();
        });
      }
    },
    { scope: "test", timeout: 5 * 60 * 1000 }
  ]
});

export const expect = test.expect;

export interface ExtensionContext {
  context: BrowserContext;
  page: Page;
}

declare global {
  const chrome: any;
}
