import type { Locator, Page } from "@playwright/test";

const PROMPT_TIMEOUT_MS = 30_000;

/** A freshly registered user is asked to accept the Fair Use Policy before any page renders, so registration is only complete once that prompt is answered; the onboarding heading is what renders instead when the gate is off. */
export async function acceptFairUsePolicyIfPrompted(page: Page): Promise<void> {
  const prompt = page.getByRole("dialog", { name: /fair use policy/i });
  const onboardingHeading = page.getByRole("heading", { name: /deploy your first app/i });

  await Promise.race([waitForVisible(prompt), waitForVisible(onboardingHeading)]);

  if (!(await prompt.isVisible())) return;

  await prompt.getByRole("button", { name: /i agree to the fair use policy/i }).click();
  await prompt.waitFor({ state: "hidden", timeout: PROMPT_TIMEOUT_MS });
}

function waitForVisible(locator: Locator): Promise<void> {
  return locator.waitFor({ state: "visible", timeout: PROMPT_TIMEOUT_MS }).catch(() => undefined);
}
