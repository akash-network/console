import { test } from "./fixture/context-with-extension";
import { FrontPage } from "./pages/FrontPage";

test("switching to another wallet in the extension affects Console", async ({ page, context, extensionId }) => {
  test.setTimeout(5 * 60 * 1000);

  const frontPage = new FrontPage(context, page);

  await frontPage.createWallet(extensionId);
});
