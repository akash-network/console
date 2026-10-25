import type { Page } from "@playwright/test";

/** The sidebar every settings page shows, listing only the settings the active organization's role may open. */
export class SettingsNav {
  constructor(readonly page: Page) {}

  link(title: string) {
    return this.page.getByRole("navigation", { name: "Settings" }).getByRole("link", { name: title, exact: true });
  }
}
