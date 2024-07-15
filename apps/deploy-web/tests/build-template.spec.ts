import { expect, test } from "@playwright/test";

import { BuildTemplatePage } from "./pages/BuildTemplatePage";

test("ssh function absence", async ({ page }) => {
  const plainLinuxPage = new BuildTemplatePage(page, "sdl-builder");
  await plainLinuxPage.gotoInteractive();

  await expect(page.getByTestId("generate-ssh-keys-btn")).not.toBeVisible();
  await expect(page.getByTestId("ssh-toggle")).not.toBeVisible();
  await expect(page.getByTestId("ssh-image-select")).not.toBeVisible();
  await expect(page.getByTestId("image-name-input")).toBeVisible();
});
