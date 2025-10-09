import { test } from "./fixture/context-with-extension";
import { FrontPage } from "./pages/FrontPage";

test("wallet stays disconnected after disconnecting and reloading", async ({ page, context }) => {
  test.setTimeout(5 * 60 * 1000);

  const frontPage = new FrontPage(context, page);

  await frontPage.disconnectWallet();
});
