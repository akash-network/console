import { expect, test } from "./fixture/base-test";
import { testEnvConfig } from "./fixture/test-env.config";
import { ConfigureDeploymentPage } from "./pages/ConfigureDeploymentPage";

const REDESIGN_TABS = ["Details", "Logs", "Events", "Shell", "Update", "Settings"];

test.describe("Deployment detail redesign preview", () => {
  test.use({ userType: "existing" });

  test("renders the redesigned header and tabs on the preview route", async ({ page }) => {
    test.setTimeout(8 * 60 * 1000);

    const configure = new ConfigureDeploymentPage(page);
    let dseq: string;

    await test.step("deploy a container through the configure flow", async () => {
      await configure.open();
      await configure.fillImageName("nginx:latest");
      await configure.requestQuotes();
      await page.waitForURL(/\/new-deployment\/configure\/\d+/, { timeout: 180_000 });

      await configure.selectFirstAvailableProvider();
      await expect(configure.reviewDialog()).toBeVisible({ timeout: 30_000 });
      await configure.confirmAndDeploy();
      await page.waitForURL(/\/deployments\/\d+/, { timeout: 180_000 });

      const match = page.url().match(/deployments\/(\d+)/);
      if (!match) throw new Error(`Could not extract DSEQ from URL: ${page.url()}`);
      dseq = match[1];
    });

    await test.step("open the redesigned preview route", async () => {
      await page.goto(`${testEnvConfig.BASE_URL}/deployments/${dseq!}/preview`);
      await expect(page).toHaveURL(new RegExp(`/deployments/${dseq!}/preview`));
    });

    await test.step("renders the summary header and full tab bar", async () => {
      await expect(page.getByText("TOTAL SERVICES")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("AUTO TOP-UP")).toBeVisible();

      for (const tab of REDESIGN_TABS) {
        await expect(page.getByRole("tab", { name: tab })).toBeVisible();
      }
    });

    await test.step("shows the placements & services overview on the Details tab", async () => {
      await expect(page.getByText("Placements", { exact: true })).toBeVisible({ timeout: 30_000 });

      const service = page.getByRole("button", { name: /service-1/ });
      await expect(service).toBeVisible();

      await service.click();
      await expect(service).toHaveAttribute("aria-expanded", "true");
    });

    await test.step("switches tabs via the tab query param without navigating", async () => {
      await page.getByRole("tab", { name: "Events" }).click();
      await expect(page).toHaveURL(new RegExp(`/deployments/${dseq!}/preview\\?tab=EVENTS`));
    });
  });
});
