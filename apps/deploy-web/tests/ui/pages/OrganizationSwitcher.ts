import type { Page } from "@playwright/test";

import { AppNav } from "./AppNav";

export class OrganizationSwitcher {
  constructor(readonly page: Page) {}

  /** Rendered for every signed-in user, named after the organization the page runs in. */
  trigger(activeOrganizationName?: string) {
    const name = activeOrganizationName ? `${activeOrganizationName}, switch organization` : /, switch organization$/;
    return this.page.getByRole("button", { name });
  }

  async createOrganization(name: string) {
    await new AppNav(this.page).accountMenuButton().click();
    await this.page.getByRole("menuitem", { name: "Create organization" }).click();
    const dialog = this.page.getByRole("dialog", { name: "Create an organization" });
    await dialog.getByLabel("Organization name").fill(name);
    await dialog.getByRole("radio", { name: /^Set up later/ }).click();
    await dialog.getByRole("button", { name: "Create organization" }).click();
  }

  async switchTo(organizationName: string) {
    await this.trigger().click();
    await this.page.getByRole("menuitemradio", { name: new RegExp(`^${escapeRegExp(organizationName)}`) }).click();
  }

  /** The personal organization is always the first row, under the "Personal account" heading. */
  async switchToPersonal() {
    await this.trigger().click();
    await this.page.getByRole("menuitemradio").first().click();
  }
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
