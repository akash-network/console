import { expect, test } from "./fixture/context-with-extension";
import { LeapExt } from "./pages/LeapExt";

test("wallet stays disconnected after disconnecting and reloading", async ({ page, context }) => {
  test.setTimeout(5 * 60 * 1000);
  const extension = new LeapExt(context, page);
  await extension.disconnectWallet();

  await expect(page.getByTestId("connect-wallet-btn")).toBeVisible();
});
