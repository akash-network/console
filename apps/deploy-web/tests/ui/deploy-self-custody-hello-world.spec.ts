import { test } from "./fixture/context-with-extension";
import { DeployPage } from "./pages/DeployPage";
import { HomePage } from "./pages/HomePage";
import { Sidebar } from "./pages/Sidebar";

test("deploy hello world via self custody wallet", async ({ context, page }) => {
  test.setTimeout(5 * 60 * 1000);

  const homePage = new HomePage(page);
  const sidebar = new Sidebar(page);
  const deployPage = new DeployPage(context, page, { walletType: "extension", feeType: "medium" });

  await test.step("navigate to deploy page and select template", async () => {
    await homePage.goto();
    await sidebar.openDeploy();
    await deployPage.selectTemplate("Hello World");
  });

  await test.step("create deployment", async () => {
    await deployPage.createDeployment();
  });

  await test.step("create lease", async () => {
    await deployPage.createLease();
  });

  await test.step("validate lease and close", async () => {
    await deployPage.validateLeaseAndClose();
  });
});
