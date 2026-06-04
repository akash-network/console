import { ManagementApiError } from "auth0";

import { detectAuthType } from "./actions/auth";
import { test } from "./fixture/base-test";
import { testEnvConfig } from "./fixture/test-env.config";
import { AuthPagePasswordless } from "./pages/AuthPagePasswordless";
import { MailsacCodeVerificationStrategy } from "./services/email-verification/mailsac-code.strategy";

test.describe("Passwordless login", () => {
  let testUserId: string | undefined;
  const otp = new MailsacCodeVerificationStrategy(testEnvConfig.MAILSAC_API_KEY);

  test.afterEach(async ({ auth0 }) => {
    if (!testUserId) return;
    try {
      await auth0.deleteUser(testUserId);
    } catch (error) {
      if (!(error instanceof ManagementApiError) || error.statusCode !== 404) {
        throw error;
      }
    } finally {
      testUserId = undefined;
    }
  });

  test("receives OTP, verifies, lands authenticated", async ({ page, auth0 }) => {
    test.setTimeout(3 * 60 * 1000);

    const authType = await detectAuthType(page);
    test.skip(authType !== "passwordless", "Skipped: /login renders email-password — passwordless flow not active in this environment");

    const email = otp.generateEmail();
    const auth = new AuthPagePasswordless(page);

    const sinceMs = Date.now();
    await auth.startWithEmail(email);
    await auth.waitForVerifyScreen();

    await otp.verify({ context: page.context(), email, userId: "", sinceMs });

    await auth.waitForRedirectAwayFromLogin();

    const auth0User = await auth0.getUserByEmail(email);
    if (!auth0User) throw new Error(`Auth0 user was not created for ${email}`);
    testUserId = auth0User.user_id;
  });
});
