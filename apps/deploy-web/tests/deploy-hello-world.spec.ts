import { selectChainNetwork } from "./actions/selectChainNetwork";
import { test } from "./fixture/context-with-extension";
import { testEnvConfig } from "./fixture/test-env.config";
import { connectWalletViaLeap, setupWallet } from "./fixture/wallet-setup";
import { DeployHelloWorldPage } from "./pages/DeployHelloWorldPage";

test("deploy hello world", async ({ context, extPage: page }) => {
  test.setTimeout(300_000);

  await setupWallet(context, page);
  await page.goto(testEnvConfig.BASE_URL);
  await connectWalletViaLeap(context, page);
  await selectChainNetwork(page, "sandbox");
  await connectWalletViaLeap(context, page);

  const helloWorldPage = new DeployHelloWorldPage(context, page, "new-deployment", "hello-world-card");

  await helloWorldPage.gotoInteractive(true);
  await helloWorldPage.createDeploymentAndSign();
  await helloWorldPage.createLeaseAndSign();
  await helloWorldPage.validateLeaseAndClose();
});
