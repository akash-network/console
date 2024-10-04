import { expect, test } from "@playwright/test";

import { SSH_VM_IMAGES } from "@src/utils/sdl/data";
import { DeployCustomTemplatePage } from "./pages/DeployCustomTemplatePage";

test("create custom template deployment", async ({ page, context }) => {
  const customTemplatePage = new DeployCustomTemplatePage(context, page, "new-deployment", "build-template-card");
  await customTemplatePage.gotoInteractive();
  await customTemplatePage.fillImageName(SSH_VM_IMAGES["Ubuntu 24.04"]);

  await page.getByTestId("create-deployment-btn").click();

  await expect(customTemplatePage.page.getByTestId("connect-wallet-btn").first()).toBeVisible();
});
