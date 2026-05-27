import { ManagementApiError } from "auth0";

import { expect, test } from "./fixture/onboarding-test";
import { testEnvConfig } from "./fixture/test-env.config";
import { AuthPagePasswordless } from "./pages/AuthPagePasswordless";
import { DeployPage } from "./pages/DeployPage";
import { OnboardingPickerPage } from "./pages/OnboardingPickerPage";
import { MailsacCodeVerificationStrategy } from "./services/email-verification/mailsac-code.strategy";

test.describe("Onboarding redesign quick deploy", () => {
  let testUserId: string | undefined;
  const otp = new MailsacCodeVerificationStrategy(testEnvConfig.MAILSAC_API_KEY);

  test.afterEach(async ({ auth0 }) => {
    if (!testUserId) return;
    const userIdToDelete = testUserId;
    testUserId = undefined;
    await auth0.deleteUser(userIdToDelete).catch(error => {
      if (!(error instanceof ManagementApiError) || error.statusCode !== 404) throw error;
    });
  });

  test("fresh passwordless user deploys hello world from /onboarding and closes it", async ({ context, page, auth0 }) => {
    test.setTimeout(10 * 60 * 1000);

    const email = otp.generateEmail();
    const authPage = new AuthPagePasswordless(page);
    const onboardingPickerPage = new OnboardingPickerPage(page);
    const deployPage = new DeployPage(context, page);

    await test.step("passwordless sign in with a fresh email", async () => {
      await authPage.goto();
      await authPage.startWithEmail(email);
      await authPage.waitForVerifyScreen();
      await otp.verify({ context: page.context(), email, userId: "" });
      await authPage.waitForRedirectAwayFromLogin();

      const auth0User = await auth0.getUserByEmail(email);
      if (!auth0User) throw new Error(`Auth0 user was not created for ${email}`);
      testUserId = auth0User.user_id;
    });

    await test.step("open onboarding picker", async () => {
      await expect(onboardingPickerPage.getHeading()).toBeVisible({ timeout: 15_000 });
    });

    await test.step("trial provisions in background — no error alert", async () => {
      await expect(page.getByText(/We couldn't set up your trial/i)).toHaveCount(0);
    });

    await test.step("pick hello world template", async () => {
      await onboardingPickerPage.deploy("Hello world");
      await expect(page.getByRole("heading", { name: /Deploying Hello world/i })).toBeVisible({ timeout: 30_000 });
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
