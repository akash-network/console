import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";

export class OrganizationSettingsPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}/organization`);
  }

  heading() {
    return this.page.getByRole("heading", { level: 1, name: "General" });
  }

  async rename(name: string) {
    const nameInput = this.page.getByRole("textbox", { name: "Name" });
    await nameInput.fill(name);
    await this.page.getByRole("button", { name: "Save" }).click();
  }
}
