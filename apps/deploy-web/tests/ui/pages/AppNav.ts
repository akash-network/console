import type { Page } from "@playwright/test";

/**
 * App navigation, agnostic to which shell is rendered: the legacy sidebar or the flag-gated top nav
 * (`ui_top_nav`). Only the top nav renders `nav[aria-label="Primary"]`, so its presence tells the two apart.
 */
export class AppNav {
  constructor(readonly page: Page) {}

  accountMenuButton() {
    return this.page.getByRole("button", { name: /account menu/i });
  }

  async openDeployments() {
    await this.page
      .getByRole("link", { name: /^deployments$/i })
      .first()
      .click();
  }

  async openDeploy() {
    if (await this.isTopNav()) {
      await this.openDeployments();
      await this.page
        .getByRole("link", { name: /^(deploy|create deployment)$/i })
        .first()
        .click();
      return;
    }
    await this.page
      .getByRole("link", { name: /^deploy$/i })
      .first()
      .click();
  }

  async openAlerts() {
    if (await this.isTopNav()) {
      await this.page.getByRole("button", { name: /^settings$/i }).click();
      await this.page.getByRole("menuitem", { name: /^alerts$/i }).click();
      return;
    }
    await this.page.getByRole("link", { name: /^alerts$/i }).click();
  }

  async openApiKeys() {
    if (await this.isTopNav()) {
      await this.page.getByRole("button", { name: /^settings$/i }).click();
      await this.page.getByRole("menuitem", { name: /^api keys$/i }).click();
      return;
    }
    await this.accountMenuButton().click();
    await this.page.getByText("API Keys").click();
  }

  /**
   * `count()` is a snapshot, so sampling it right after a `waitUntil: "commit"` navigation can miss the top nav
   * before it paints and misclassify the shell as legacy. Both shells render the account menu, and TopNav's
   * primary nav resolves from the same user state in the same pass, so waiting on it first makes the read reliable.
   */
  private async isTopNav() {
    await this.accountMenuButton().waitFor({ state: "visible" });
    return (await this.page.getByRole("navigation", { name: "Primary" }).count()) > 0;
  }
}
