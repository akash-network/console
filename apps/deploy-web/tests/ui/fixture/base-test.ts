import type { Page } from "@playwright/test";
import { test as baseTest } from "@playwright/test";

import { loginExistingUser, registerNewUser } from "../actions/auth";
import { closeAllActiveDeployments } from "../actions/deployment-janitor";
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
const emailVerification = createEmailVerificationStrategy();

type Fixtures = {
  /** Who the test runs as. Omit for no auth precondition. */
  userType?: UserType;
  auth0: Auth0ManagementService;
  emailVerification: EmailVerificationStrategy;
};

export const test = baseTest.extend<Fixtures>({
  userType: [undefined, { option: true }],
  // eslint-disable-next-line no-empty-pattern
  auth0: async ({}, use) => {
    await use(auth0);
  },
  // eslint-disable-next-line no-empty-pattern
  emailVerification: async ({}, use) => {
    await use(emailVerification);
  },
  page: async ({ page, userType }, use) => {
    await injectUIConfig(page);
    await routeTestingClientToken(page);

    let createdUserId: string | undefined;
    if (userType === "existing") {
      await loginExistingUser(page);
    } else if (userType === "new") {
      createdUserId = (await registerNewUser(page, { auth0, emailVerification })).userId;
    }

    await use(page);

    if (userType) {
      await closeDeploymentsLeftBehind(page);
    }

    if (createdUserId) {
      await auth0.deleteUser(createdUserId).catch(() => undefined);
    }
  }
});

export const expect = test.expect;

/**
 * A deployment outlives the account that owns it and keeps draining escrow, so every authenticated test hands its
 * account back empty. This has to happen while the session is still usable, before the fixture deletes a
 * throwaway Auth0 user, after which nothing can reach that user's deployments any more.
 */
async function closeDeploymentsLeftBehind(page: Page) {
  const closed = await closeAllActiveDeployments(page, testEnvConfig.BASE_URL);

  if (closed.length) {
    test.info().annotations.push({ type: "closed deployments", description: closed.join(", ") });
  }
}

/**
 * Cloudflare's always-pass, invisible dummy sitekey. The visible always-pass variant (1x...AA) can still enter an
 * interactive challenge that no test ever solves, which stalls sign-in until the whole budget burns.
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/#dummy-sitekeys-and-secret-keys
 */
const ALWAYS_PASS_INVISIBLE_SITE_KEY = "1x00000000000000000000BB";

export async function injectUIConfig(page: Page) {
  await page.addInitScript(siteKey => {
    (window as any).__AK_INJECTED_CONFIG__ = Object.freeze({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: siteKey });
  }, ALWAYS_PASS_INVISIBLE_SITE_KEY);
}

/**
 * Tags the auth API calls with the e2e testing token so the app applies its test-only config.
 * Needed whenever a flow signs in or signs up.
 */
export function routeTestingClientToken(page: Page) {
  return page.route(/\/api\/auth\/(password-login|password-signup|email-code-start|email-code-verify)$/, (route, request) =>
    route.continue({ headers: { ...request.headers(), "x-testing-client-token": testEnvConfig.E2E_TESTING_CLIENT_TOKEN } })
  );
}
