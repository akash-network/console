import type { Page } from "@playwright/test";

export async function isWalletConnected(page: Page) {
  return page
    .getByLabel("Connected wallet name and balance")
    .waitFor({ state: "visible", timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
}
