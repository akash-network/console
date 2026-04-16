import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";

export class HomePage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto(testEnvConfig.BASE_URL);
  }

  async startTrial() {
    await this.page.getByRole("button", { name: /start trial/i }).click();
  }
}
