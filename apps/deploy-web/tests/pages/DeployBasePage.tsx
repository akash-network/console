import { type BrowserContext as Context, expect, type Page } from "@playwright/test";

export class DeployBasePage {
  constructor(
    readonly context: Context = context,
    readonly page: Page,
    readonly path: string,
    readonly cardTestId?: string
  ) {}

  async goto() {
    await this.page.goto(`http://localhost:3000/${this.path}`);
  }

  async gotoInteractive() {
    if (this.cardTestId) {
      // await this.page.goto("http://localhost:3000");
      // await this.page.getByTestId("welcome-modal-accept-button").click();
      await this.page.getByTestId("sidebar-deploy-button").first().click();
      await this.page.getByTestId(this.cardTestId).click();
    }
  }

  async generateSSHKeys() {
    const downloadPromise = this.page.waitForEvent("download");
    await this.page.getByTestId("generate-ssh-keys-btn").click();

    return {
      download: await downloadPromise,
      input: this.page.getByTestId("ssh-public-key-input")
    };
  }

  async createDeployment() {
    await this.page.getByTestId("create-deployment-btn").click();
    await this.page.getByTestId("deposit-modal-continue-button").click();
  }

  async createLease() {
    await this.page.getByTestId("create-lease-filter-audited").click();
    await this.page.getByTestId("bid-list-row-radio-0").click();
    await this.page.getByTestId("create-lease-button").click();
  }

  async validateLease() {
    await this.page.waitForURL(/http:\/\/localhost:3000\/deployments\/\d+/);
    await expect(this.page.getByText("SuccessfulCreate", { exact: true })).toBeVisible({ timeout: 10000 });
    await this.page.getByTestId("deployment-tab-leases").click();
    await this.page.getByTestId("lease-list-row-0").isVisible();
    await expect(this.page.getByTestId("lease-row-0-state")).toHaveText("active");
  }

  async closeDeploymentDetail() {
    await this.page.getByTestId("deployment-detail-dropdown").click();
    await this.page.getByTestId("deployment-detail-close-button").click();
  }

  async signTransaction() {
    const popupPage = await this.context.waitForEvent("page");
    await popupPage.waitForLoadState("domcontentloaded");
    await popupPage.getByRole("button", { name: "Approve" }).click();
  }
}
