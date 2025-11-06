import { shortenAddress } from "@akashnetwork/ui/components";
import type { BrowserContext as Context, Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";

export type AuthorizeButtonLabel = "Authorize Spend" | "Authorize Fee Spend";
export type AuthorizationListLabel = "Deployment Authorization List" | "Tx Fee Authorization List";

export class AuthorizationsPage {
  constructor(
    readonly context: Context,
    readonly page: Page
  ) {}

  async goto(url = `${testEnvConfig.BASE_URL}/settings/authorizations`) {
    await this.page.goto(url);
  }

  async clickGrantButton() {
    return await this.page.getByRole("button", { name: "Grant" }).click();
  }

  async authorizeSpending(address: string, buttonLabel: AuthorizeButtonLabel) {
    await this.page.getByRole("button", { name: buttonLabel }).click();
    await this.page.getByLabel("Spending Limit").fill("5");
    await this.page.getByLabel("Grantee Address").fill(address);
    await this.clickGrantButton();
  }

  async editSpending(address: string, listLabel: AuthorizationListLabel) {
    const shortenedAddress = shortenAddress(address);
    await this.page.getByLabel(listLabel).locator("tr", { hasText: shortenedAddress }).getByLabel("Edit Authorization").click();
    await this.page.getByLabel("Spending Limit").fill("10");
    await this.clickGrantButton();
  }

  async revokeSpending(address: string, listLabel: AuthorizationListLabel) {
    const shortenedAddress = shortenAddress(address);
    await this.page.getByLabel(listLabel).locator("tr", { hasText: shortenedAddress }).getByLabel("Revoke Authorization").click();
    await this.page.getByTestId("confirm-button").click();
  }
}
