import type { Page } from "@playwright/test";

import type { FeeType } from "./cosmjs-web-wallet";
import { cosmjsWebWallet } from "./cosmjs-web-wallet";
import { initLeapWebWalletMock } from "./initLeapWebWalletMock";

export type { FeeType } from "./cosmjs-web-wallet";

export function setFeeType(feeType: FeeType) {
  cosmjsWebWallet.setFeeType(feeType);
}

export async function switchWebWallet(page: Page, mnemonic: string) {
  await cosmjsWebWallet.switchWallet(mnemonic);
  await page.evaluate(() => window.dispatchEvent(new Event("leap_keystorechange")));
}

const RPC_HANDLER_NAME = "__akashCosmjsWalletRpc";

export async function injectWebWallet(page: Page, mnemonic: string) {
  await cosmjsWebWallet.switchWallet(mnemonic);
  await page.exposeFunction(RPC_HANDLER_NAME, async (method: keyof typeof cosmjsWebWallet, args: unknown[]) => {
    const handler = cosmjsWebWallet[method] as (...args: unknown[]) => Promise<unknown>;
    if (!handler) throw new Error(`Unknown wallet RPC method: ${method}`);

    const result = await handler(...args);
    return result;
  });
  await page.addInitScript(initLeapWebWalletMock, {
    rpcHandlerName: RPC_HANDLER_NAME
  });
}
