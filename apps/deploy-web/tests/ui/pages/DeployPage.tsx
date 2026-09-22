import type { BrowserContext as Context, Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";

export class DeployPage {
  constructor(
    readonly context: Context,
    readonly page: Page
  ) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}/new-deployment`);
  }

  async selectTemplate(name: string) {
    await this.page.getByLabel(name).or(this.page.getByRole("link", { name })).first().click();
  }
}
