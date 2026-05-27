import type { Page } from "@playwright/test";
import { test as baseTest } from "@playwright/test";

import { type AuthType, loginExistingUser, registerNewUser } from "../actions/auth";
import { Auth0ManagementService } from "../services/auth0-management.service";
import { createEmailVerificationStrategy, type EmailVerificationStrategy } from "../services/email-verification";
import { testEnvConfig } from "./test-env.config";

export * from "@playwright/test";
export { getUserAgent } from "./user-agent";

/**
 * Whether the test runs as the preconfigured TEST_USER or a freshly registered one.
 * Omit it entirely for public pages or tests that drive auth themselves.
 */
export type UserType = "existing" | "new";

const auth0 = new Auth0ManagementService();
const emailVerification = createEmailVerificationStrategy(auth0);

type Fixtures = {
  /** Who the test runs as. Omit for no auth precondition. */
  userType?: UserType;
  /** Which credential mechanism to authenticate with. Passwordless is reserved for new onboarding flows. */
  authType: AuthType;
  auth0: Auth0ManagementService;
  emailVerification: EmailVerificationStrategy;
};

export const test = baseTest.extend<Fixtures>({
  userType: [undefined, { option: true }],
  authType: ["email-password", { option: true }],
  // eslint-disable-next-line no-empty-pattern
  auth0: async ({}, use) => {
    await use(auth0);
  },
  // eslint-disable-next-line no-empty-pattern
  emailVerification: async ({}, use) => {
    await use(emailVerification);
  },
  page: async ({ page, userType, authType }, use) => {
    await injectUIConfig(page);
    await routeTestingClientToken(page);

    let createdUserId: string | undefined;
    if (userType === "existing") {
      await loginExistingUser(page, authType);
    } else if (userType === "new") {
      createdUserId = (await registerNewUser(page, { auth0, emailVerification, authType })).userId;
    }

    await use(page);

    if (createdUserId) {
      await auth0.deleteUser(createdUserId).catch(() => undefined);
    }
  }
});

export const expect = test.expect;

export async function injectUIConfig(page: Page) {
  await page.addInitScript(() => {
    (window as any).__AK_INJECTED_CONFIG__ = Object.freeze({
      // always pass turnstile site key: https://developers.cloudflare.com/turnstile/troubleshooting/testing/#dummy-sitekeys-and-secret-keys
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA"
    });
  });
}

/**
 * Tags the auth API calls with the e2e testing token so the app applies its test-only config.
 * Needed whenever a flow signs in or signs up.
 */
function routeTestingClientToken(page: Page) {
  return page.route(/\/api\/auth\/(password-login|password-signup|email-code-start|email-code-verify)$/, (route, request) =>
    route.continue({ headers: { ...request.headers(), "x-testing-client-token": testEnvConfig.E2E_TESTING_CLIENT_TOKEN } })
  );
}
