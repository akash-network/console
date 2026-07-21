import type { Page } from "@playwright/test";

import { closeActiveDeployment } from "./actions/deploy";
import { expect, test } from "./fixture/base-test";
import { testEnvConfig } from "./fixture/test-env.config";
import { ConfigureDeploymentPage } from "./pages/ConfigureDeploymentPage";
import { DeployPage } from "./pages/DeployPage";
import { OnboardingPickerPage } from "./pages/OnboardingPickerPage";

/**
 * The real new-user onboarding journeys, driven the way a user drives them: the fixture registers a fresh user
 * through the live /login UI (email OTP via Mailsac); from there the test only clicks — it never deep-links to a
 * functional page. Two entry points off the onboarding picker: a one-click template auto-deploy, and the "bring
 * your own Docker image" path that lands in the configure screen for a manual deploy. Both end with the user
 * onboarded (and no longer sent to onboarding), closing the deployment so the run leaves no live state behind.
 */
test.describe("Onboarding journey — new user's first deployment", () => {
  test.use({ userType: "new" });
  test.setTimeout(10 * 60 * 1000);

  test("picks a template and the app auto-deploys it", async ({ context, page }) => {
    const picker = new OnboardingPickerPage(page);
    const deployPage = new DeployPage(context, page);

    await test.step("a brand-new user opening the app is guided to onboarding", async () => {
      await visit(page, "/");
      await page.waitForURL(/\/onboarding/, { timeout: 60_000 });
      await expect(picker.getHeading()).toBeVisible({ timeout: 30_000 });
    });

    await test.step("picking the Hello world template starts an automatic deployment", async () => {
      await picker.deploy("Hello world");
      await expect(page.getByRole("heading", { name: /Deploying Hello world/i })).toBeVisible({ timeout: 30_000 });
    });

    await test.step("the deployment goes live on its own and lands on the details page", async () => {
      await page.waitForURL(new RegExp(`${testEnvConfig.BASE_URL}/deployments/\\d+`), { timeout: 6 * 60 * 1000 });
      await deployPage.openTab("Leases");
      await expect(page.getByLabel("Lease 0 state")).toHaveText("active", { timeout: 60_000 });
    });

    await test.step("close the deployment this run created", async () => {
      await deployPage.closeDeployment();
      await expect(page.getByText(/are you sure you want to close/i)).toBeVisible({ timeout: 5_000 });
      await page.getByRole("button", { name: /confirm/i }).click();
      await expect(page.getByLabel("Lease 0 state")).toHaveText("closed", { timeout: 30_000 });
    });

    await test.step("having deployed once, revisiting onboarding sends the user into the console", async () => {
      await visit(page, "/onboarding");
      await page.waitForURL(url => new URL(url).pathname !== "/onboarding", { timeout: 30_000 });
    });
  });

  test("brings their own Docker image and deploys it from configure", async ({ page }) => {
    const picker = new OnboardingPickerPage(page);
    const configure = new ConfigureDeploymentPage(page);
    let dseq: string | undefined;

    await test.step("a brand-new user opening the app is guided to onboarding", async () => {
      await visit(page, "/");
      await page.waitForURL(/\/onboarding/, { timeout: 60_000 });
      await expect(picker.getHeading()).toBeVisible({ timeout: 30_000 });
    });

    await test.step("choosing 'Deploy image' opens the configure screen", async () => {
      await picker.deployImage();
      await expect(configure.dockerImageInput()).toBeVisible({ timeout: 30_000 });
      await configure.fillImageName("nginx:latest");
    });

    await test.step("requesting quotes creates the deployment (still no lease yet)", async () => {
      await configure.requestQuotes();
      await page.waitForURL(/\/new-deployment\/configure\/\d+/, { timeout: 180_000 });
      dseq = new URL(page.url()).pathname.match(/\/new-deployment\/configure\/(\d+)/)?.[1];
      expect(dseq).toBeTruthy();
      await expect(configure.marketplaceHeading()).toBeVisible({ timeout: 30_000 });
    });

    await test.step("selecting a provider creates the lease and lands on the deployment", async () => {
      await configure.selectFirstAvailableProvider();
      await expect(configure.reviewDialog()).toBeVisible({ timeout: 30_000 });
      await configure.confirmAndDeploy();
      await page.waitForURL(new RegExp(`/deployments/${dseq}(?:[/?]|$)`), { timeout: 180_000 });
    });

    await test.step("close the deployment this run created", async () => {
      await closeActiveDeployment(page);
    });

    await test.step("having deployed once, revisiting onboarding sends the user into the console", async () => {
      await visit(page, "/onboarding");
      await page.waitForURL(url => new URL(url).pathname !== "/onboarding", { timeout: 30_000 });
    });
  });
});

/**
 * Navigates and returns as soon as the navigation commits, without blocking on `load` — some app pages hold
 * long-lived connections that never fire `load`, and the gate can redirect client-side mid-navigation. The
 * `waitForURL` after each call does the real waiting.
 */
async function visit(page: Page, path: string) {
  await page.goto(`${testEnvConfig.BASE_URL}${path}`, { waitUntil: "commit" });
}
