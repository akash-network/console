import { expect, test } from "./fixture/base-test";
import { DeployPage } from "./pages/DeployPage";
import { TemplateDetailPage } from "./pages/TemplateDetailPage";

test.use({ userType: "existing" });

test("user can choose a template on deployment page", async ({ page, context }) => {
  test.setTimeout(3 * 60 * 1000);

  const deploymentPage = new DeployPage(context, page);
  await deploymentPage.goto();

  const templateCards = deploymentPage.popularTemplateCards();
  await expect(templateCards.nth(0)).toBeVisible({ timeout: 15_000 });

  const templateCount = await templateCards.count();

  for (let i = 0; i < templateCount; i++) {
    const card = templateCards.nth(i);
    const templateName = (await card.getByRole("heading").textContent()) ?? `template ${i}`;

    await test.step(`verify template "${templateName}"`, async () => {
      const href = await card.getAttribute("href");
      const newPage = await context.newPage();
      await newPage.goto(new URL(href!, page.url()).href);

      await expect(new TemplateDetailPage(newPage).title(templateName)).toBeVisible({ timeout: 15_000 });
      await newPage.getByRole("link", { name: "Deploy template" }).click();

      const deploymentName = await newPage.getByLabel("Deployment name").inputValue({ timeout: 15_000 });
      await expect(card).toContainText(deploymentName);
      await newPage.close();
    });
  }
});
