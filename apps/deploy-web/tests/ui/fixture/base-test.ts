import type { Page } from "@playwright/test";
import { test as baseTest } from "@playwright/test";

import { testEnvConfig } from "./test-env.config";

export * from "@playwright/test";

export const test = baseTest.extend({
  page: async ({ page }, use) => {
    await injectUIConfig(page);
    await use(page);
  }
});

export const expect = test.expect;

export async function injectUIConfig(page: Page) {
  if (!testEnvConfig.UI_CONFIG_SIGNATURE_PRIVATE_KEY) {
    return;
  }

  await page.addInitScript(() => {
    (window as any).__AK_INJECTED_CONFIG__ = Object.freeze({
      // always pass token: https://deelopers.cloudflare.com/turnstile/troubleshooting/testing/#dummy-sitekeys-and-secret-keys
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA"
    });
  });
}
