import { AuthPage } from "../pages/AuthPage";
import { test as baseTest } from "./base-test";
import { testEnvConfig } from "./test-env.config";

export { expect } from "./base-test";

export const test = baseTest.extend<{ login: () => Promise<void> }>({
  page: async ({ page }, use) => {
    await page.route("**/api/auth/password-login", (route, request) => {
      route.continue({
        headers: { ...request.headers(), "x-testing-client-token": testEnvConfig.E2E_TESTING_CLIENT_TOKEN }
      });
    });
    await use(page);
  },
  login: async ({ page }, use) => {
    const login = async () => {
      if (!testEnvConfig.TEST_USER_EMAIL || !testEnvConfig.TEST_USER_PASSWORD) {
        throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD env vars are required for authenticated tests");
      }

      const authPage = new AuthPage(page);
      await authPage.signIn({ email: testEnvConfig.TEST_USER_EMAIL, password: testEnvConfig.TEST_USER_PASSWORD });
      await page.waitForURL(url => !url.pathname.includes("/login"), { timeout: 15_000 });

      await page.getByLabel("Connected wallet name and balance").waitFor({ timeout: 30_000 });
    };

    await use(login);
  }
});
