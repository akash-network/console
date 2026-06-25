import { expect, test } from "./fixture/base-test";
import { ConfigureDeploymentPage } from "./pages/ConfigureDeploymentPage";

test.describe("Configure deployment — request quotes flow", () => {
  test.use({ userType: "existing" });

  test("requests quotes to create a deployment, locks the pane, then cancels and edits to close it", async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);

    const configure = new ConfigureDeploymentPage(page);

    await test.step("configure a deployment", async () => {
      await configure.goto();
      await configure.fillImageName("nginx:latest");
    });

    await test.step("request quotes creates the deployment and locks the pane", async () => {
      await configure.requestQuotes();

      // the created deployment's dseq is mirrored into the route segment
      await page.waitForURL(/\/new-deployment\/configure\/\d+/, { timeout: 90_000 });

      // the spec panes lock: a banner is shown and the inputs are disabled
      await expect(configure.lockBannerText().first()).toBeVisible({ timeout: 30_000 });
      await expect(configure.cpuInput()).toBeDisabled();
      await expect(configure.dockerImageInput()).toBeDisabled();

      // the marketplace is scoped to the placement and lists offers
      await expect(configure.marketplaceHeading()).toBeVisible();
    });

    await test.step("cancel and edit closes the deployment and unlocks the pane", async () => {
      await configure.cancelAndEdit();

      // closing drops the dseq from the route
      await page.waitForURL(url => !/\/new-deployment\/configure\/\d+/.test(url.pathname), { timeout: 90_000 });

      await expect(configure.lockBannerText()).toHaveCount(0);
      await expect(configure.cpuInput()).toBeEnabled();
      await expect(configure.requestQuotesButton()).toBeVisible();
    });
  });
});
