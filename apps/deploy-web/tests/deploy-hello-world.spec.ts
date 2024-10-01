import { test } from "./fixture/fixture";
import { setupLeap } from "./fixture/wallet-setup";
import { DeployHelloWorldPage } from "./pages/DeployHelloWorldPage";

test("deploy hello world", async ({ extPage: page, context }) => {
  await setupLeap(context, page);

  const customTemplatePage = new DeployHelloWorldPage(context, page, "new-deployment", "hello-world-card");

  await customTemplatePage.createDeployment();
  await customTemplatePage.createLease(); 
  await customTemplatePage.validateLeaseAndClose();

  await page.pause();
});
