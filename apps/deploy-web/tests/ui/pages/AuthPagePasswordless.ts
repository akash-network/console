import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";

export class AuthPagePasswordless {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}/login-v2`);
  }

  async startWithEmail(email: string) {
    await this.page.getByLabel("Email", { exact: true }).fill(email);
    await this.page.getByRole("button", { name: /continue with email/i }).click();
  }

  async waitForVerifyScreen() {
    await this.page.getByLabel("Verification code digit 1").waitFor({ state: "visible" });
  }

  async waitForRedirectAwayFromLogin() {
    await this.page.waitForURL(url => !/^\/login(\/|$)/.test(url.pathname) && !/^\/login-v2(\/|$)/.test(url.pathname));
  }
}
