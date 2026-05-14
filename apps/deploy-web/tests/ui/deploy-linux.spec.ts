import { expect, test } from "./fixture/base-test";
import { HomePage } from "./pages/HomePage";
import { Sidebar } from "./pages/Sidebar";

import { PlainLinuxPage } from "@tests/ui/pages/PlainLinuxPage";

test("ssh keys generation", async ({ page, context }) => {
  const homePage = new HomePage(page);
  const sidebar = new Sidebar(page);
  const deployPage = new PlainLinuxPage(context, page);

  await homePage.goto();
  await sidebar.openDeploy();

  await deployPage.selectTemplate("Launch Container-VM");
  await deployPage.selectDistro("Ubuntu 24.04");

  const { input, download } = await deployPage.generateSSHKeys();

  expect(download.suggestedFilename()).toBe("keypair.zip");
  await expect(input).toHaveValue(/ssh-/);

  await page.getByRole("button", { name: /create deployment/i }).click();

  await expect(page.getByRole("button", { name: /connect wallet/i }).first()).toBeVisible();
});
