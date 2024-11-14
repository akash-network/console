import { test } from "./fixture/fixture";
import { setupLeap } from "./fixture/wallet-setup";
import { DeployHelloWorldPage } from "./pages/DeployHelloWorldPage";

test("deploy hello world", async ({ extPage: page, context }) => {
  await setupLeap(context, page);

  const helloWorldPage = new DeployHelloWorldPage(context, page, "new-deployment", "hello-world-card");

  await helloWorldPage.gotoInteractive(true);
  await helloWorldPage.createDeploymentAndSign();
  await helloWorldPage.createLeaseAndSign();
  await helloWorldPage.validateLeaseAndClose();
});
