import { type Page } from "@playwright/test";

export class DeployBasePage {
  constructor(
    readonly page: Page,
    readonly path: string,
    readonly cardTestId?: string
  ) {}

  async goto() {
    await this.page.goto(`http://localhost:3000/${this.path}`);
  }

  async gotoInteractive() {
    if (this.cardTestId) {
      await this.page.goto("http://localhost:3000");
      await this.page.getByTestId("welcome-modal-accept-button").click();
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

  async submit() {
    await this.page.getByTestId("create-deployment-btn").click();
  }
}
