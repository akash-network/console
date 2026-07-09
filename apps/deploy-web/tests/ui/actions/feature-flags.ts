import type { Page } from "@playwright/test";

import { test } from "../fixture/base-test";
import { testEnvConfig } from "../fixture/test-env.config";

/**
 * Whether the onboarding redesign (`onboarding_redesign_v1`) is live in this environment. Probed via the
 * flag-gated configure screen, which serves 200 when the flag is on and 404 when off — reliable regardless of
 * the user's onboarding state, unlike probing `/onboarding` (which the gate redirects an already-onboarded
 * user away from).
 */
export async function isOnboardingRedesignAvailable(page: Page): Promise<boolean> {
  const response = await page.goto(`${testEnvConfig.BASE_URL}/new-deployment/configure`);
  return (response?.status() ?? 404) < 400;
}

/** Skips the test unless the onboarding redesign is live — the new-page flows don't exist on the legacy pages. */
export async function skipUnlessOnboardingRedesign(page: Page) {
  test.skip(!(await isOnboardingRedesignAvailable(page)), "Requires the onboarding redesign (onboarding_redesign_v1).");
}

/** Skips the test when the onboarding redesign is live — the legacy onboarding/builder flow is superseded by it. */
export async function skipIfOnboardingRedesign(page: Page) {
  test.skip(await isOnboardingRedesignAvailable(page), "Superseded by the onboarding redesign (onboarding_redesign_v1).");
}
