import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";

export class InvitationPage {
  constructor(readonly page: Page) {}

  async goto(token: string) {
    await this.page.goto(`${testEnvConfig.BASE_URL}/invitations#token=${token}`);
  }

  heading(organizationName: string) {
    return this.page.getByRole("heading", { name: `Join ${organizationName}` });
  }

  async signUpToAccept() {
    await this.page.getByRole("link", { name: "Sign up to accept" }).click();
  }

  async accept() {
    await this.page.getByRole("button", { name: "Accept invitation" }).click();
  }
}
