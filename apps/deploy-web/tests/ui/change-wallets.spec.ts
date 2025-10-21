import { expect } from "@playwright/test";

import { test } from "./fixture/context-with-extension";
import { LeapExt } from "./pages/LeapExt";

test("switching to another wallet in the extension affects Console", async ({ page, context, extensionId }) => {
  test.setTimeout(5 * 60 * 1000);

  const extension = new LeapExt(context, page);

  const newWalletName = await extension.createWallet(extensionId);

  const container = page.getByLabel("Connected wallet name and balance");
  await container.waitFor({ state: "visible", timeout: 20_000 });
  await expect(container).toHaveText(newWalletName);
});
