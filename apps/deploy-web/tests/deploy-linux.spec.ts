import { expect, test } from "@playwright/test";

import { PlainLinuxPage } from "./pages/PlainLinuxPage";

test("ssh keys generation", async ({ page }) => {
  const plainLinuxPage = new PlainLinuxPage(page, "deploy-linux", "plain-linux-card");
  await plainLinuxPage.gotoInteractive();
  await plainLinuxPage.selectDistro("Ubuntu 24.04");

  const { input, download } = await plainLinuxPage.generateSSHKeys();

  expect(download.suggestedFilename()).toBe("keypair.zip");
  await expect(input).toHaveValue(/ssh-/);

  await plainLinuxPage.submit();

  await expect(plainLinuxPage.page.getByTestId("connect-wallet-btn").first()).toBeVisible();
});
