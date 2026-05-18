import { expect, test } from "./fixture/authenticated-test";
import { testEnvConfig } from "./fixture/test-env.config";
import { AuthPage } from "./pages/AuthPage";
import { DeployPage } from "./pages/DeployPage";
import { HomePage } from "./pages/HomePage";
import { OnboardingPickerPage } from "./pages/OnboardingPickerPage";

test.describe("Onboarding redesign quick deploy", () => {
  test("deploys hello world from /onboarding and closes it", async ({ context, page, login }) => {
    test.setTimeout(7 * 60 * 1000);

    const homePage = new HomePage(page);
    const authPage = new AuthPage(page);
    const onboardingPickerPage = new OnboardingPickerPage(page);
    const deployPage = new DeployPage(context, page, { walletType: "api" });

    await test.step("login", async () => {
      await homePage.goto();
      await homePage.openSignIn();
      await authPage.waitForPage();
      await login();
    });

    await test.step("open onboarding picker", async () => {
      await onboardingPickerPage.goto();
      await expect(onboardingPickerPage.getHeading()).toBeVisible({ timeout: 15_000 });
    });

    await test.step("pick hello world template", async () => {
      await onboardingPickerPage.deploy("Hello world");
      await expect(page.getByRole("heading", { name: /Deploying Hello world/i })).toBeVisible({ timeout: 15_000 });
    });

    await test.step("wait for deployment details page", async () => {
      await page.waitForURL(new RegExp(`${testEnvConfig.BASE_URL}/deployments/\\d+`), { timeout: 6 * 60 * 1000 });
      await expect(page.getByLabel("Lease 0 state")).toHaveText("active", { timeout: 60_000 });
    });

    await test.step("close deployment", async () => {
      await deployPage.closeDeployment();
      await expect(page.getByText(/are you sure you want to close/i)).toBeVisible({ timeout: 5_000 });
      await page.getByRole("button", { name: /confirm/i }).click();
    });

    await test.step("verify deployment is closed", async () => {
      await expect(page.getByLabel("Lease 0 state")).toHaveText("closed", { timeout: 30_000 });
    });
  });
});
