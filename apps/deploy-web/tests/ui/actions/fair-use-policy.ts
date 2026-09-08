import type { Page } from "@playwright/test";

const PROMPT_TIMEOUT_MS = 30_000;

/** A freshly registered user is asked to accept the Fair Use Policy before any page renders, so registration is only complete once that prompt is answered. */
export async function acceptFairUsePolicyIfPrompted(page: Page): Promise<void> {
  const prompt = page.getByRole("dialog", { name: /fair use policy/i });
  const isPrompted = await prompt.waitFor({ state: "visible", timeout: PROMPT_TIMEOUT_MS }).then(
    () => true,
    () => false
  );

  if (!isPrompted) return;

  await prompt.getByRole("button", { name: /i agree to the fair use policy/i }).click();
  await prompt.waitFor({ state: "hidden", timeout: PROMPT_TIMEOUT_MS });
}
