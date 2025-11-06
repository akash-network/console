import type { Page } from "@playwright/test";

export async function isWalletConnected(page: Page) {
  const result = await Promise.race([
    page
      .getByLabel("Connected wallet name and balance")
      .waitFor({ state: "visible", timeout: 30_000 })
      .then(() => true)
      .catch(() => null),
    page
      .getByTestId("connect-wallet-btn")
      .waitFor({ state: "visible", timeout: 30_000 })
      .then(() => false)
      .catch(() => null)
  ]);

  if (result === null) {
    throw new Error("Wallet is not connected and there is no button to connect it");
  }

  return result;
}
