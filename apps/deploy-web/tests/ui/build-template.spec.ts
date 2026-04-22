import { expect, test } from "./fixture/base-test";
import { BuildTemplatePage } from "./pages/BuildTemplatePage";

test("ssh function absence", async ({ page, context }) => {
  const sdlBuilderPage = new BuildTemplatePage(context, page);
  await sdlBuilderPage.gotoInteractive();

  await expect(page.getByRole("button", { name: /generate new key/i })).not.toBeVisible();
  await expect(page.getByRole("checkbox", { name: /expose ssh/i })).not.toBeVisible();
  await expect(page.getByRole("combobox", { name: /os image/i })).not.toBeVisible();
  await expect(page.getByLabel(/docker image/i)).toBeVisible();
});
