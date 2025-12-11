import { shortenAddress } from "@akashnetwork/ui/components";
import type { BrowserContext as Context, Locator, Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";
import { LeapExt } from "./LeapExt";

export type AuthorizationType = "deployment" | "tx_fee";

const AUTHORIZE_BUTTON_LABELS = {
  deployment: "Authorize Spend",
  tx_fee: "Authorize Fee Spend"
};
const AUTHORIZATION_LIST_LABELS = {
  deployment: {
    title: /Deployment Authorization/i,
    emptyTitle: /No authorizations given/i
  },
  tx_fee: {
    title: /Tx Fee Authorization/i,
    emptyTitle: /No allowances issued/i
  }
};

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

  async authorizeSpending(type: AuthorizationType, address: string) {
    await this.page.getByRole("button", { name: AUTHORIZE_BUTTON_LABELS[type] }).click();
    await this.page.getByLabel("Spending Limit").fill("5");
    await this.page.getByLabel("Grantee Address").fill(address);
    await this.clickGrantButton();
  }

  async editSpending(type: AuthorizationType, address: string) {
    const shortenedAddress = shortenAddress(address);
    await this.getListLocator(type).locator("tr", { hasText: shortenedAddress }).getByLabel("Edit Authorization").click();
    await this.page.getByLabel("Spending Limit").fill("10");
    await this.clickGrantButton();
  }

  async revokeSpending(type: AuthorizationType, address: string) {
    const shortenedAddress = shortenAddress(address);
    await this.page.getByLabel(AUTHORIZATION_LIST_LABELS[type].title).locator("tr", { hasText: shortenedAddress }).getByLabel("Revoke Authorization").click();
    await this.page.getByRole("button", { name: "Confirm" }).click();
  }

  async revokeAll(type: AuthorizationType): Promise<void> {
    const extension = new LeapExt(this.context, this.page);
    const selectors = AUTHORIZATION_LIST_LABELS[type];
    const hasGrants = await Promise.race([
      this.getListLocator(type)
        .getByRole("button", { name: /revoke all/i })
        .click()
        .then(
          () => true,
          () => false
        ),
      this.getListLocator(type)
        .getByText(selectors.emptyTitle)
        .waitFor({ state: "visible" })
        .then(
          () => false,
          () => true
        )
    ]);
    if (hasGrants) {
      await Promise.all([this.page.getByRole("button", { name: "Confirm" }).click(), extension.acceptTransaction("high")]);
      await extension.waitForTransaction("success");
    }
  }

  getListLocator(type: AuthorizationType): Locator {
    return this.page.getByLabel(AUTHORIZATION_LIST_LABELS[type].title);
  }
}
