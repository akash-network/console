import { expect, test } from "./fixture/base-test";
import { BuildTemplatePage } from "./pages/BuildTemplatePage";

test("ssh function absence", async ({ page, context }) => {
  const sdlBuilderPage = new BuildTemplatePage(context, page, "sdl-builder");
  await sdlBuilderPage.gotoInteractive();

  await expect(page.getByTestId("generate-ssh-keys-btn")).not.toBeVisible();
  await expect(page.getByTestId("ssh-toggle")).not.toBeVisible();
  await expect(page.getByTestId("ssh-image-select")).not.toBeVisible();
  await expect(page.getByTestId("image-name-input")).toBeVisible();
});
