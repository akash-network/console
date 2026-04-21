import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";

export class AuthPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}/login`);
  }

  async waitForPage() {
    await this.page.waitForURL(/\/login/);
  }

  async waitForSignUpTab() {
    await this.page.waitForURL(/\/login.*tab=signup/);
  }

  async signIn(input: { email: string; password: string }) {
    const logInTab = this.page.getByRole("tab", { name: /log in/i });
    if (await logInTab.isVisible()) {
      await logInTab.click();
    }

    await this.page.getByLabel("Email").fill(input.email);
    await this.page.getByLabel("Password").fill(input.password);
    await this.page.getByRole("button", { name: /log in/i }).click();
  }

  async signUp(input: { email: string; password: string }) {
    const signUpTab = this.page.getByRole("tab", { name: /sign up/i });
    if (await signUpTab.isVisible()) {
      await signUpTab.click();
    }

    await this.page.getByLabel("Email").fill(input.email);
    await this.page.getByLabel("Password").fill(input.password);
    await this.page.getByRole("checkbox").check();
    await this.page.getByRole("button", { name: /sign up/i }).click();
  }
}
