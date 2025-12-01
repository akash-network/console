import { expect } from "@playwright/test";

import { test } from "./fixture/context-with-extension";
import { LeapExt } from "./pages/LeapExt";

test.describe("Custodial wallet", () => {
  test("switching to another wallet in the extension switches the wallet in Console", async ({ page, context, extensionId }) => {
    const extension = new LeapExt(context, page);

    const newWalletAddress = await extension.createWallet(extensionId);

    const container = page.getByLabel("Connected wallet name and balance");
    await container.waitFor({ state: "visible", timeout: 20_000 });
    await container.hover({ timeout: 20_000 });
    await page.getByLabel("wallet address").click();
    const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());

    expect(clipboardContent).toEqual(newWalletAddress);
  });

  test("wallet stays disconnected after disconnecting and reloading", async ({ page, context }) => {
    const extension = new LeapExt(context, page);
    await extension.disconnectWallet();

    await expect(page.getByTestId("connect-wallet-btn")).toBeVisible({ timeout: 20_000 });
  });
});
