import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";

/** The usage page, whose team view reports what each project spent over the chosen range. */
export class UsagePage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}/usage`);
  }

  /** A row of "Spend by project", which shows the project's consumed amount and, under it, what was committed to it. */
  projectRow(projectName: string) {
    return this.page.getByRole("region", { name: "Spend by project" }).getByRole("listitem").filter({ hasText: projectName });
  }
}
