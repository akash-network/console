import { expect, test } from "./fixture/base-test";
import { DeployBasePage } from "./pages/DeployBasePage";

test("user can choose a template from the templates page", async ({ page, context }) => {
  const templateListPage = new DeployBasePage(context, page, "new-deployment");
  await templateListPage.goto();

  const templateList = page.getByLabel("Template list");

  await expect(templateList).toBeVisible();

  const templateLinks = templateList.getByRole("link");
  await expect(templateLinks.nth(0)).toBeVisible({ timeout: 15_000 });

  const templateCount = await templateLinks.count();

  for (let i = 0; i < templateCount; i++) {
    const link = templateLinks.nth(i);
    const [newPage] = await Promise.all([context.waitForEvent("page"), link.click({ modifiers: ["Shift"] })]);

    const templateName = await newPage.getByLabel(/Name your deployment/i).inputValue();
    await expect(link).toContainText(templateName);
    await newPage.close();
  }
});
