import { generateTestPassword, signUpViaUI } from "./actions/auth";
import { expect, test } from "./fixture/managed-wallet-test";
import { HomePage } from "./pages/HomePage";
import { OnboardingPage } from "./pages/OnboardingPage";

test.describe("Managed wallet onboarding", () => {
  let testUserId: string | undefined;

  test.afterEach(async ({ auth0 }) => {
    if (testUserId) {
      await auth0.deleteUser(testUserId).catch(() => {});
      testUserId = undefined;
    }
  });

  test("completes free trial start, signup, and email verification", async ({ page, auth0, emailVerification }) => {
    test.setTimeout(2 * 60 * 1000);

    const email = emailVerification.generateEmail();
    const password = generateTestPassword();
    const homePage = new HomePage(page);
    const onboardingPage = new OnboardingPage(page);

    await test.step("start trial from home page", async () => {
      await homePage.goto();
      await homePage.startTrial();
    });

    await test.step("begin free trial onboarding", async () => {
      await onboardingPage.startFreeTrial();
    });

    await test.step("sign up with email and password", async () => {
      await page.waitForURL(/\/login.*tab=signup/);
      await signUpViaUI(page, { email, password });
    });

    await test.step("arrive at email verification step", async () => {
      await page.waitForURL(/\/signup/);
      await expect(onboardingPage.getCheckVerificationButton()).toBeVisible({ timeout: 15_000 });
    });

    await test.step("verify email via verification link", async () => {
      const auth0User = await auth0.getUserByEmail(email);
      expect(auth0User).toBeTruthy();
      testUserId = auth0User!.user_id;

      await emailVerification.verify({ context: page.context(), email, userId: testUserId! });
    });

    await test.step("confirm email verification on onboarding page", async () => {
      await onboardingPage.getCheckVerificationButton().click();
      await expect(onboardingPage.getEmailVerifiedAlert()).toBeVisible({ timeout: 15_000 });
      await onboardingPage.getContinueButton().click();
    });
  });
});
