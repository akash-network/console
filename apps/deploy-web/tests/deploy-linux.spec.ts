import { expect, test } from "@playwright/test";

import { PlainLinuxPage } from "./pages/PlainLinuxPage";

test("ssh keys generation", async ({ page, context }) => {
  const plainLinuxPage = new PlainLinuxPage(context, page, "deploy-linux", "plain-linux-card");
  await plainLinuxPage.gotoInteractive();
  await plainLinuxPage.selectDistro("Ubuntu 24.04");

  const { input, download } = await plainLinuxPage.generateSSHKeys();

  expect(download.suggestedFilename()).toBe("keypair.zip");
  await expect(input).toHaveValue(/ssh-/);

  await page.getByTestId("create-deployment-btn").click();

  await expect(plainLinuxPage.page.getByTestId("connect-wallet-btn").first()).toBeVisible();
});
