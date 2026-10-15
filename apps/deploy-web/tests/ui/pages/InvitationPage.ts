import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";

export class InvitationPage {
  constructor(readonly page: Page) {}

  /** Keeps the link's token but opens it on the environment under test, whatever host the api put in the link. */
  async goto(link: string) {
    const { hash } = new URL(link);
    await this.page.goto(`${testEnvConfig.BASE_URL}/invitations${hash}`);
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
