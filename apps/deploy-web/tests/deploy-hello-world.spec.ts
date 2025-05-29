import { selectChainNetwork } from "./actions/selectChainNetwork";
import { test } from "./fixture/context-with-extension";
import { testEnvConfig } from "./fixture/test-env.config";
import { connectWalletViaLeap, setupWallet } from "./fixture/wallet-setup";
import { DeployHelloWorldPage } from "./pages/DeployHelloWorldPage";
import { isWalletConnected } from "./uiState/isWalletConnected";

test("deploy hello world", async ({ context, page }) => {
  test.setTimeout(5 * 60 * 1000);

  await setupWallet(context, page);
  await page.goto(testEnvConfig.BASE_URL);
  console.log("on website");
  await connectWalletViaLeap(context, page);
  console.log("connected wallet");
  await selectChainNetwork(page, "sandbox");
  console.log("selected chain network");

  if (!(await isWalletConnected(page))) {
    await connectWalletViaLeap(context, page);
    console.log("reconnected wallet on sandbox");
  }

  const helloWorldPage = new DeployHelloWorldPage(context, page, "new-deployment", "hello-world-card");

  await helloWorldPage.gotoInteractive(true);
  console.log("opened deploy hello world page");
  await helloWorldPage.createDeploymentAndSign();
  console.log("created deployment and sign");
  await helloWorldPage.createLeaseAndSign();
  console.log("created lease and sign");
  await helloWorldPage.validateLeaseAndClose();
  console.log("validated lease and closed deployment");
});
