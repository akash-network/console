import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import type { BrowserContext, Page } from "@playwright/test";

import { selectChainNetwork } from "../actions/selectChainNetwork";
import { injectWebWallet } from "./web-wallet/injectWebWallet";
import { injectUIConfig, test as baseTest } from "./base-test";
import { testEnvConfig } from "./test-env.config";
import { connectWalletViaLeap, topUpWallet } from "./wallet-setup";

// @see https://playwright.dev/docs/chrome-extensions
export const test = baseTest.extend<ExtensionContext>({
  page: [
    async ({ context }, use) => {
      const page = await createPage(context);

      try {
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

export async function createPage(context: BrowserContext): Promise<Page> {
  const w = await DirectSecp256k1HdWallet.fromMnemonic(testEnvConfig.TEST_WALLET_MNEMONIC, { prefix: "akash" });
  const accounts = await w.getAccounts();
  await topUpWallet(accounts[0].address);

  const page = await context.newPage();
  await injectUIConfig(page);
  await injectWebWallet(page, testEnvConfig.TEST_WALLET_MNEMONIC);

  if (testEnvConfig.NETWORK_ID !== "mainnet") {
    await page.goto(testEnvConfig.BASE_URL);
    await connectWalletViaLeap(context, page);
    await selectChainNetwork(page, testEnvConfig.NETWORK_ID);
  }

  await page.goto(testEnvConfig.BASE_URL);
  await connectWalletViaLeap(context, page);
  return page;
}
