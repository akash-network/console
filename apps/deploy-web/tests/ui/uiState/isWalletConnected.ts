import type { Page } from "@playwright/test";

export async function isWalletConnected(page: Page) {
  const result = await Promise.race([
    page
      .getByLabel("Connected wallet name and balance")
      .waitFor({ state: "visible" })
      .then(() => true)
      .catch(() => null),
    page
      .getByRole("button", { name: /connect wallet/i })
      .waitFor({ state: "visible" })
      .then(() => false)
      .catch(() => null)
  ]);

  if (result === null) {
    throw new Error("Wallet is not connected and there is no button to connect it");
  }

  return result;
}
