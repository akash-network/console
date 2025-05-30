import { test } from "./fixture/context-with-extension";
import { DeployHelloWorldPage } from "./pages/DeployHelloWorldPage";

test("deploy hello world", async ({ context, page }) => {
  test.setTimeout(5 * 60 * 1000);

  const helloWorldPage = new DeployHelloWorldPage(context, page, "new-deployment", "hello-world-card");

  await helloWorldPage.gotoInteractive();
  await helloWorldPage.createDeploymentAndSign();
  await helloWorldPage.createLeaseAndSign();
  await helloWorldPage.validateLeaseAndClose();
});
