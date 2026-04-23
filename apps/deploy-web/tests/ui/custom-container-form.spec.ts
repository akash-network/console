import { SSH_VM_IMAGES } from "@src/utils/sdl/data";
import { expect, test } from "./fixture/base-test";
import { DeployPage } from "./pages/DeployPage";
import { HomePage } from "./pages/HomePage";
import { Sidebar } from "./pages/Sidebar";

test("custom container form shows connect wallet prompt", async ({ page, context }) => {
  const homePage = new HomePage(page);
  const sidebar = new Sidebar(page);
  const deployPage = new DeployPage(context, page, { walletType: "extension" });

  await homePage.goto();
  await sidebar.openDeploy();
  await deployPage.selectTemplate("Run Custom Container");
  await deployPage.fillImageName(SSH_VM_IMAGES["Ubuntu 24.04"]);
  await page.getByRole("button", { name: /create deployment/i }).click();

  await expect(page.getByRole("button", { name: /connect wallet/i }).first()).toBeVisible();
});
