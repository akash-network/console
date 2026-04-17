import { Auth0ManagementService } from "../services/auth0-management.service";
import { createEmailVerificationStrategy, type EmailVerificationStrategy } from "../services/email-verification";
import { test as baseTest } from "./base-test";
import { testEnvConfig } from "./test-env.config";

export { expect } from "./base-test";

const auth0Management = new Auth0ManagementService();
const emailVerificationStrategy = createEmailVerificationStrategy(auth0Management);

export const test = baseTest.extend<{ auth0: Auth0ManagementService; emailVerification: EmailVerificationStrategy }>({
  page: async ({ page }, use) => {
    await page.route("**/api/auth/password-signup", (route, request) => {
      route.continue({
        headers: { ...request.headers(), "x-testing-client-token": testEnvConfig.E2E_TESTING_CLIENT_TOKEN }
      });
    });
    await use(page);
  },
  // eslint-disable-next-line no-empty-pattern
  auth0: async ({}, use) => {
    await use(auth0Management);
  },
  // eslint-disable-next-line no-empty-pattern
  emailVerification: async ({}, use) => {
    await use(emailVerificationStrategy);
  }
});
