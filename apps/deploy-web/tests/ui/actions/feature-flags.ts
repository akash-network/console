import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";

/**
 * Navigates to /onboarding and reports whether the redesigned onboarding picker
 * is reachable in this environment. Returns true when the page stays on /onboarding,
 * false when the SSR guard redirects (e.g. to /).
 *
 * Side effect: leaves the page on /onboarding when available, so callers can
 * continue driving the picker directly without an extra navigation.
 */
export async function isOnboardingRedesignAvailable(page: Page): Promise<boolean> {
  await page.goto(`${testEnvConfig.BASE_URL}/onboarding`);
  await page.waitForLoadState("domcontentloaded");
  return new URL(page.url()).pathname === "/onboarding";
}
