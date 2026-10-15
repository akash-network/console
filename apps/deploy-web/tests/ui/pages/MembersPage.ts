import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";

export class MembersPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}/members`);
  }

  heading() {
    return this.page.getByRole("heading", { level: 1, name: "Members" });
  }

  async inviteMember(input: { organizationName: string; email: string; projectName: string }) {
    await this.page.getByRole("button", { name: "Invite members" }).click();
    const dialog = this.page.getByRole("dialog", { name: `Invite to ${input.organizationName}` });
    await dialog.getByLabel("Email addresses").fill(input.email);
    await dialog.getByLabel("Email addresses").press("Enter");
    await dialog.getByRole("radio", { name: /^Member/ }).check();
    await dialog.getByRole("combobox", { name: "Add a project" }).click();
    await this.page.getByRole("option", { name: input.projectName, exact: true }).click();
    await dialog.getByRole("button", { name: "Send invite" }).click();
  }

  /** Mints a fresh link, which retires the emailed one, and reads it back from the clipboard. */
  async copyInviteLink(email: string): Promise<string> {
    await this.page
      .getByRole("list", { name: "Pending invitations" })
      .getByRole("button", { name: `Actions for the invite to ${email}` })
      .click();
    await this.page.getByRole("menuitem", { name: "Copy invite link" }).click();
    await this.page.getByText("Invite link copied").waitFor();

    return await this.page.evaluate(() => navigator.clipboard.readText());
  }

  /** Rows are named after the username when the member has one, so a member is found by the email every row shows. */
  memberRow(email: string) {
    return this.page.getByRole("list", { name: "Members" }).getByRole("listitem").filter({ hasText: email });
  }

  async removeMember(email: string) {
    await this.memberRow(email)
      .getByRole("button", { name: /^Actions for / })
      .click();
    await this.page.getByRole("menuitem", { name: "Remove from organization" }).click();
    await this.page
      .getByRole("dialog", { name: /^Remove .+\?$/ })
      .getByRole("button", { name: "Confirm" })
      .click();
  }
}
