import type { BrowserContext, Page } from "@playwright/test";
import { chromium } from "@playwright/test";
import os from "os";
import path from "path";

import { selectChainNetwork } from "../actions/selectChainNetwork";
import { getUserAgent, injectUIConfig, test as baseTest } from "./base-test";
import { testEnvConfig } from "./test-env.config";
import { awaitWalletAndApprove, connectWalletViaLeap, getExtensionPage, setupWallet } from "./wallet-setup";

export const PATH_TO_EXTENSION = path.join(os.tmpdir(), "console-deploy-web-e2e-tests", "Leap");

// @see https://playwright.dev/docs/chrome-extensions
export const test = baseTest.extend<ExtensionContext>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({ contextOptions }, use) => {
    const args = [
      // keep new line
      `--disable-extensions-except=${PATH_TO_EXTENSION}`,
      `--load-extension=${PATH_TO_EXTENSION}`
    ];

    const userDataDirForTest = `${testEnvConfig.USER_DATA_DIR}-${crypto.randomUUID()}`;
    const context = await chromium.launchPersistentContext(userDataDirForTest, {
      ...contextOptions,
      userAgent: getUserAgent(),
      channel: "chromium",
      args,
      permissions: (contextOptions.permissions ?? []).concat(["clipboard-read", "clipboard-write"])
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
      const page = await context.newPage();
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
        await extPage.close();
        await use(page);
      } finally {
        await page.close();
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
