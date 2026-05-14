import { testEnvConfig } from "../fixture/test-env.config";
import { DeployPage } from "./DeployPage";

export class BuildTemplatePage extends DeployPage {
  async gotoInteractive() {
    await this.page.goto(testEnvConfig.BASE_URL);
    await this.page
      .getByRole("link", { name: /sdl builder/i })
      .first()
      .click();
  }

  async addService() {
    await this.page.getByRole("button", { name: /add service/i }).click();
  }

  async clickDeploy() {
    await this.page.getByRole("button", { name: /^deploy$/i }).click();
  }

  async clickPreview() {
    await this.page.getByRole("button", { name: /preview/i }).click();
  }

  getPreviewTextLocator(text: string) {
    return this.page.getByText(text).first();
  }

  async closePreview() {
    await this.page.getByRole("button", { name: /close/i }).first().click();
  }

  getDeployButton() {
    return this.page.getByRole("button", { name: /^deploy$/i });
  }

  getPreviewButton() {
    return this.page.getByRole("button", { name: /preview/i });
  }

  getAddServiceButton() {
    return this.page.getByRole("button", { name: /add service/i });
  }

  getServiceLocator(serviceName: string) {
    const escapedName = serviceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return this.page.getByText(new RegExp(`${escapedName}:`)).first();
  }

  async waitForServiceAdded(serviceName: string, timeout = 10000) {
    await this.page.locator(`input[type="text"][value="${serviceName}"]`).first().waitFor({ state: "visible", timeout });
  }
}
