import { test } from "./utils/fixture";

import { DeployHelloWorldPage } from "./pages/DeployHelloWorldPage";
import { setupLeap } from "./utils/wallet";

// test.describe.configure({ mode: "serial" });

test.only("deploy hello world", async ({ extPage: page, extensionId, context }) => {
  await setupLeap(context, page, extensionId);

  const customTemplatePage = new DeployHelloWorldPage(page, "new-deployment", "build-template-card");
  await customTemplatePage.gotoInteractive();
  await page.pause();
});
