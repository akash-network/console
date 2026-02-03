import type { Page } from "@playwright/test";
import { devices, test as baseTest } from "@playwright/test";

export * from "@playwright/test";

export const test = baseTest.extend({
  page: async ({ page }, use) => {
    await injectUIConfig(page);
    await use(page);
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

export function getUserAgent() {
  return `${devices["Desktop Chrome"].userAgent} UIT/${process.env.E2E_TESTING_CLIENT_TOKEN}.`;
}
