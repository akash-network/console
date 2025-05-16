import type { Page, Request, Route } from "@playwright/test";
import { test as baseTest } from "@playwright/test";

import { testEnvConfig } from "./test-env.config";

export * from "@playwright/test";

export const test = baseTest.extend<{
  page: Page;
}>({
  page: async ({ page }, use) => {
    await addUITestsToken(page);
    await use(page);
  }
});

export async function addUITestsToken(page: Page) {
  const uiTestsToken = testEnvConfig.UI_TESTS_TOKEN;

  if (uiTestsToken) {
    await page.route(`${testEnvConfig.BASE_URL}/api/config`, async (route: Route, request: Request) => {
      await route.continue({
        headers: {
          ...request.headers(),
          "x-ui-tests-token": uiTestsToken
        }
      });
    });
  }
}
