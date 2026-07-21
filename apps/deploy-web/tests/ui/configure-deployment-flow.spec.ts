import { closeActiveDeployment } from "./actions/deploy";
import { expect, test } from "./fixture/base-test";
import { ConfigureDeploymentPage } from "./pages/ConfigureDeploymentPage";

test.describe("Configure deployment — request quotes flow", () => {
  test.use({ userType: "existing" });

  test.afterEach(async function closeDeploymentLeftByTest({ page }) {
    if (/\/deployments\/\d+/.test(new URL(page.url()).pathname)) {
      await closeActiveDeployment(page);
    }
  });

  test("requests quotes to create a deployment, locks the pane, then cancels and edits to close it", async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);

    const configure = new ConfigureDeploymentPage(page);

    await test.step("configure a deployment", async () => {
      await configure.open();
      await configure.fillImageName("nginx:latest");
    });

    await test.step("request quotes creates the deployment and locks the pane", async () => {
      await configure.requestQuotes();

      // the created deployment's dseq is mirrored into the route segment
      await page.waitForURL(/\/new-deployment\/configure\/\d+/, { timeout: 15_000 });

      await expect(configure.lockBannerText().first()).toBeVisible();
      await expect(configure.cpuInput()).toBeDisabled();
      await expect(configure.dockerImageInput()).toBeEnabled();

      // the marketplace is scoped to the placement and lists offers
      await expect(configure.marketplaceHeading()).toBeVisible();
    });

    await test.step("cancel and edit closes the deployment and unlocks the pane", async () => {
      await configure.cancelAndEdit();
      await expect(configure.cancellingButton()).toBeVisible();

      await expect(configure.cancellingButton()).not.toBeVisible({ timeout: 15_000 });
      await expect(configure.lockBannerText()).toHaveCount(0);
      await expect(configure.cpuInput()).toBeEnabled();
      await expect(configure.requestQuotesButton()).toBeVisible();
    });
  });

  test("selects a provider, reviews, and deploys", async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    const configure = new ConfigureDeploymentPage(page);
    let dseq: string | undefined;

    await test.step("request quotes to create the deployment and surface bids", async () => {
      await configure.open();
      await configure.fillImageName("nginx:latest");
      await configure.requestQuotes();

      await page.waitForURL(/\/new-deployment\/configure\/\d+/, { timeout: 90_000 });
      dseq = new URL(page.url()).pathname.match(/\/new-deployment\/configure\/(\d+)/)?.[1];
      expect(dseq).toBeTruthy();
      await expect(configure.marketplaceHeading()).toBeVisible({ timeout: 30_000 });
    });

    await test.step("selecting the only placement's provider auto-opens the review", async () => {
      // waits for the first submitted bid's Select button, then picks it
      await configure.selectFirstAvailableProvider();

      // the last selection completes every placement, so the review modal opens on its own
      await expect(configure.reviewDialog()).toBeVisible({ timeout: 30_000 });
      await expect(configure.reviewDialog().getByText(/total deployment cost/i)).toBeVisible();
    });

    await test.step("confirming creates the lease and redirects to the deployment created in this run", async () => {
      await configure.confirmAndDeploy();
      await page.waitForURL(new RegExp(`/deployments/${dseq}(?:[/?]|$)`), { timeout: 180_000 });
    });
  });
});

test.describe("Configure deployment — draft persistence", () => {
  test.use({ userType: "existing" });

  test("restores edits to the deployment spec after a reload", async ({ page }) => {
    const configure = new ConfigureDeploymentPage(page);

    await configure.open();
    await configure.fillImageName("nginx:1.2.3-draft");

    // a minted draft id is mirrored into the URL, and the working SDL is persisted (debounced) under it
    await page.waitForURL(/draftId=/, { timeout: 15_000 });
    await expect.poll(() => configure.getPersistedDraft(), { timeout: 15_000 }).toContain("nginx:1.2.3-draft");

    await configure.reload();

    await expect(configure.dockerImageInput()).toHaveValue("nginx:1.2.3-draft");
  });
});
