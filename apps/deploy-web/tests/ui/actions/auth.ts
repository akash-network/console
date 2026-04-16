import type { Page } from "@playwright/test";

export async function signUpViaUI(page: Page, input: { email: string; password: string }) {
  const signUpTab = page.getByRole("tab", { name: /sign up/i });

  if (await signUpTab.isVisible()) {
    await signUpTab.click();
  }

  await page.getByLabel("Email").fill(input.email);
  await page.getByLabel("Password").fill(input.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /sign up/i }).click();
}

export async function signInViaUI(page: Page, input: { email: string; password: string }) {
  const logInTab = page.getByRole("tab", { name: /log in/i });
  if (await logInTab.isVisible()) {
    await logInTab.click();
  }

  await page.getByLabel("Email").fill(input.email);
  await page.getByLabel("Password").fill(input.password);
  await page.getByRole("button", { name: /log in/i }).click();
}

export function generateTestCredentials(): { email: string; password: string } {
  const id = crypto.randomUUID().slice(0, 8);
  return {
    email: `e2e-${id}@test.akash.network`,
    password: `E2e!${crypto.randomUUID()}`
  };
}
