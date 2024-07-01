import { expect, test } from "@playwright/test";

import { SSH_VM_IMAGES } from "@src/utils/sdl/data";
import { DeployCustomTemplatePage } from "./pages/DeployCustomTemplatePage";

test("ssh keys generation", async ({ page }) => {
  const customTemplatePage = new DeployCustomTemplatePage(page, "new-deployment", "build-template-card");
  await customTemplatePage.gotoInteractive();
  await customTemplatePage.fillImageName(SSH_VM_IMAGES["Ubuntu 24.04"]);
  await customTemplatePage.toggleSsh();

  const { input, download } = await customTemplatePage.generateSSHKeys();

  expect(download.suggestedFilename()).toBe("keypair.zip");
  await expect(input).toHaveValue(/ssh-/);

  await customTemplatePage.submit();

  await expect(customTemplatePage.page.getByTestId("connect-wallet-btn").first()).toBeVisible();
});
