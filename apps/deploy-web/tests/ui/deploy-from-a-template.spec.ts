import { expect, test } from "./fixture/base-test";
import { DeployBasePage } from "./pages/DeployBasePage";

test("user can choose a template from the templates page", async ({ page, context }) => {
  const templateListPage = new DeployBasePage(context, page, "new-deployment");
  await templateListPage.goto();

  const templateList = page.locator('[aria-label="Template list"]');

  await expect(templateList).toBeVisible();

  const templateLinks = templateList.getByRole("link");
  const templateCount = await templateLinks.count();
  expect(templateCount).toBeGreaterThan(0);

  for (let i = 0; i < templateCount; i++) {
    const [newPage] = await Promise.all([context.waitForEvent("page"), templateLinks.nth(i).click({ modifiers: ["Shift"] })]);

    await expect(newPage).toHaveURL(/\/new-deployment\?step=edit-deployment&templateId=.*/);
    await newPage.close();
  }
});
