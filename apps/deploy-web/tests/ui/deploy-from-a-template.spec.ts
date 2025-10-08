import random from "lodash/random";

import { expect, test } from "./fixture/base-test";
import { DeployBasePage } from "./pages/DeployBasePage";

test("user can choose a template from the templates page", async ({ page, context }) => {
  const templateListPage = new DeployBasePage(context, page, "new-deployment");
  await templateListPage.goto();

  const templateList = page.locator('[aria-label="Template list"]');

  await expect(templateList).toBeVisible();

  const templateLinks = templateList.locator("> a");
  expect(await templateLinks.count()).toBeGreaterThan(0);
  await templateLinks.nth(random(0, (await templateLinks.count()) - 1)).click();

  await expect(page).toHaveURL(/\/new-deployment\?step=edit-deployment&templateId=.*/);
});
