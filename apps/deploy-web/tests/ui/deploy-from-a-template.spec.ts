import { expect, test } from "./fixture/base-test";
import { DeployPage } from "./pages/DeployPage";

test("user can choose a template on deployment page", async ({ page, context }) => {
  test.setTimeout(3 * 60 * 1000);

  const deploymentPage = new DeployPage(context, page);
  await deploymentPage.goto();

  const templateList = page.getByLabel("Template list");

  await expect(templateList).toBeVisible();

  const templateLinks = templateList.getByRole("link");
  await expect(templateLinks.nth(0)).toBeVisible({ timeout: 15_000 });

  const templateCount = await templateLinks.count();

  for (let i = 0; i < templateCount; i++) {
    const link = templateLinks.nth(i);
    const linkText = (await link.textContent())?.split("\n")[0] ?? `template ${i}`;

    await test.step(`verify template "${linkText}"`, async () => {
      const href = await link.getAttribute("href");
      const newPage = await context.newPage();
      await newPage.goto(new URL(href!, page.url()).href);

      const templateName = await newPage.getByLabel(/Name your deployment/i).inputValue({ timeout: 15_000 });
      await expect(link).toContainText(templateName);
      await newPage.close();
    });
  }
});
