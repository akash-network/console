import { DeployHelloWorldPage } from "./pages/DeployHelloWorldPage";
import { test } from "./utils/fixture";
import { setupLeap } from "./utils/wallet";

// test.describe.configure({ mode: "serial" });

test.only("deploy hello world", async ({ extPage: page, context }) => {
  await setupLeap(context, page);

  const customTemplatePage = new DeployHelloWorldPage(context, page, "new-deployment", "hello-world-card");

  // Create deployment
  await customTemplatePage.gotoInteractive();
  await customTemplatePage.createDeployment();
  await customTemplatePage.signTransaction();

  // Create lease
  await customTemplatePage.createLease();
  await customTemplatePage.signTransaction();

  // Validate lease and close
  await customTemplatePage.validateLease();
  await customTemplatePage.closeDeploymentDetail();
  await customTemplatePage.signTransaction();

  await page.pause();
});
