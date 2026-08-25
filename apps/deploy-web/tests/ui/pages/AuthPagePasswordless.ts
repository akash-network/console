import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";

/**
 * The verify screen appears only once the OTP request reaches Auth0 and the email is dispatched, which outruns the
 * 15s actionTimeout on beta.
 */
const VERIFY_SCREEN_TIMEOUT_MS = 45_000;

export class AuthPagePasswordless {
  constructor(readonly page: Page) {}

  get emailInput() {
    return this.page.getByLabel("Email", { exact: true });
  }

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}/login`);
  }

  async startWithEmail(email: string) {
    await this.emailInput.fill(email);
    await this.page.getByRole("button", { name: /continue with email/i }).click();
  }

  async waitForVerifyScreen() {
    await this.page.getByLabel("Verification code digit 1").waitFor({ state: "visible", timeout: VERIFY_SCREEN_TIMEOUT_MS });
  }

  async waitForRedirectAwayFromLogin() {
    await this.page.waitForURL(url => !/^\/login(\/|$)/.test(url.pathname));
  }

  async goBack() {
    await this.page.goBack();
  }
}
