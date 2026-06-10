import { ManagementApiError } from "auth0";

import { signInPasswordless } from "./actions/auth";
import { expect, test } from "./fixture/base-test";
import { testEnvConfig } from "./fixture/test-env.config";
import { HomePage } from "./pages/HomePage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { MailsacCodeVerificationStrategy } from "./services/email-verification/mailsac-code.strategy";

test.describe("Passwordless auth", () => {
  let createdUserId: string | undefined;
  const otp = new MailsacCodeVerificationStrategy(testEnvConfig.MAILSAC_API_KEY);

  test.afterEach(async ({ auth0 }) => {
    if (!createdUserId) return;
    try {
      await auth0.deleteUser(createdUserId);
    } catch (error) {
      if (!(error instanceof ManagementApiError) || error.statusCode !== 404) {
        throw error;
      }
    } finally {
      createdUserId = undefined;
    }
  });

  test("new user registers via passwordless and lands on onboarding", async ({ page, auth0 }) => {
    test.setTimeout(3 * 60 * 1000);

    const email = otp.generateEmail();

    await page.goto(`${testEnvConfig.BASE_URL}/login`);
    await signInPasswordless(page, email);

    const auth0User = await auth0.getUserByEmail(email);
    if (!auth0User) throw new Error(`Auth0 user was not created for ${email}`);
    createdUserId = auth0User.user_id;

    expect(await new OnboardingPage(page).isCurrentPage()).toBe(true);
  });

  test("existing user logs in via passwordless and lands on the home page", async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);

    await page.goto(`${testEnvConfig.BASE_URL}/login`);
    await signInPasswordless(page, testEnvConfig.TEST_USER_EMAIL!);

    expect(await new HomePage(page).isCurrentPage()).toBe(true);
  });
});
