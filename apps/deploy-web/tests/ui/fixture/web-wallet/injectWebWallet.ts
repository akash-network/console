import type { Page } from "@playwright/test";

import type { FeeType } from "./CosmjsWebWallet";
import { CosmjsWebWallet } from "./CosmjsWebWallet";
import { initKeplrWebWalletMock } from "./initKeplrWebWalletMock";

export type { FeeType } from "./CosmjsWebWallet";

const WALLETS = new Map<Page, CosmjsWebWallet>();
const getWallet = (page: Page): CosmjsWebWallet => {
  let wallet = WALLETS.get(page);
  if (!wallet) {
    wallet = new CosmjsWebWallet();
    WALLETS.set(page, wallet);
    page.once("close", () => WALLETS.delete(page));
  }
  return wallet;
};

export function setFeeType(page: Page, feeType: FeeType) {
  getWallet(page).setFeeType(feeType);
}

export async function switchWebWallet(page: Page, mnemonic: string) {
  await getWallet(page).switchWallet(mnemonic);
  await page.evaluate(() => window.dispatchEvent(new Event("keplr_keystorechange")));
}

const RPC_HANDLER_NAME = "__akashCosmjsWalletRpc";

export async function injectWebWallet(page: Page, mnemonic: string) {
  const wallet = getWallet(page);
  await wallet.switchWallet(mnemonic);
  await page.exposeFunction(RPC_HANDLER_NAME, async (method: keyof typeof wallet, args: unknown[]) => {
    if (!wallet[method]) throw new Error(`Unknown wallet RPC method: ${method}`);
    const result = await (wallet[method] as (...args: unknown[]) => Promise<unknown>)(...args);
    return result;
  });
  await page.addInitScript(initKeplrWebWalletMock, {
    rpcHandlerName: RPC_HANDLER_NAME
  });
}
