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

  acceptButton() {
    return this.page.getByRole("button", { name: "Accept invitation" });
  }

  signUpLink() {
    return this.page.getByRole("link", { name: "Sign up to accept" });
  }

  revokedNotice() {
    return this.page.getByRole("heading", { name: "This invitation was revoked" });
  }

  /** Asked before joining with an account whose email is not the one the invitation was sent to. */
  emailMismatchDialog() {
    return this.page.getByRole("dialog", { name: "Join with a different email?" });
  }

  async confirmEmailMismatch() {
    await this.emailMismatchDialog().getByRole("button", { name: "Confirm" }).click();
  }

  async declineEmailMismatch() {
    await this.emailMismatchDialog().getByRole("button", { name: "Cancel" }).click();
  }
}
