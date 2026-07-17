import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";
import { AppNav } from "./AppNav";

export class HomePage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto(testEnvConfig.BASE_URL);
  }

  /**
   * Waits for the authenticated shell to settle (the account menu rendered, present in both the sidebar and top
   * nav) and resolves true when the app stayed on home rather than redirecting to onboarding or signup, i.e. the
   * current user is an existing, onboarded one.
   */
  async isCurrentPage(): Promise<boolean> {
    await new AppNav(this.page).accountMenuButton().waitFor({ state: "visible", timeout: 30_000 });
    return !/^\/(onboarding|signup)/.test(new URL(this.page.url()).pathname);
  }

  async startTrial() {
    await this.page.getByRole("button", { name: /start trial/i }).click();
  }

  async openSignIn() {
    await new AppNav(this.page).accountMenuButton().click();
    await this.page.getByText("Sign in").click();
  }

  getAddFundsLink() {
    return this.page.getByRole("link", { name: /add funds/i });
  }
}
