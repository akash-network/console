import type { Locator, Page } from "@playwright/test";

const PROMPT_TIMEOUT_MS = 30_000;

/** Matches both presentations: an onboarding user gets the prompt as a page section, everyone else gets it as a modal. */
function locatePrompt(page: Page): Locator {
  return page.getByRole("region", { name: /fair use policy/i }).or(page.getByRole("dialog", { name: /fair use policy/i }));
}

/**
 * Races the prompt against what the page shows once no prompt is coming: the onboarding heading a new user lands on,
 * unless the caller names another landmark.
 */
export async function acceptFairUsePolicyIfPrompted(page: Page, options: { settledBy?: Locator } = {}): Promise<void> {
  const prompt = locatePrompt(page);
  const settledBy = options.settledBy ?? page.getByRole("heading", { name: /deploy your first app/i });

  await Promise.race([waitForVisible(prompt), waitForVisible(settledBy)]);

  if (!(await prompt.isVisible())) return;

  await prompt.getByRole("button", { name: /i agree to the fair use policy/i }).click();
  await prompt.waitFor({ state: "hidden", timeout: PROMPT_TIMEOUT_MS });
}

function waitForVisible(locator: Locator): Promise<void> {
  return locator.waitFor({ state: "visible", timeout: PROMPT_TIMEOUT_MS }).catch(() => undefined);
}
