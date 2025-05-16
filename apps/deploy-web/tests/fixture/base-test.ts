import type { Request, Route } from "@playwright/test";
import { test } from "@playwright/test";

import { testEnvConfig } from "./test-env.config";

export * from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const uiTestsToken = testEnvConfig.UI_TESTS_TOKEN;
  if (!uiTestsToken) return;

  const addUITestsToken = async (route: Route, request: Request) => {
    await route.continue({
      headers: {
        ...request.headers(),
        "x-ui-tests-token": uiTestsToken
      }
    });
  };
  await page.route("**/api-mainnet/**", addUITestsToken);
  await page.route("**/api-sandbox/**", addUITestsToken);
});
