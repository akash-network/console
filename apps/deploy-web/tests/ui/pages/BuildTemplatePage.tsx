import { testEnvConfig } from "../fixture/test-env.config";
import { DeployBasePage } from "./DeployBasePage";

export class BuildTemplatePage extends DeployBasePage {
  async gotoInteractive() {
    await this.page.goto(testEnvConfig.BASE_URL);
    await this.page.getByTestId("sidebar-sdl-builder-link").first().click();
  }

  async fillImageName(imageName: string) {
    await this.page.getByTestId("image-name-input").fill(imageName);
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

  async clickReset() {
    await this.page.getByRole("button", { name: /reset/i }).click();
  }

  getPreviewTextLocator(text: string) {
    return this.page.getByText(text).first();
  }

  async closePreview() {
    await this.page.getByRole("button", { name: /close/i }).first().click();
  }

  getImageNameInput() {
    return this.page.getByTestId("image-name-input");
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

  getServiceNameInput(serviceName: string) {
    return this.page.getByRole("textbox").filter({ hasText: serviceName });
  }

  async waitForServiceAdded(serviceName: string, timeout = 10000) {
    await this.page.locator(`input[type="text"][value="${serviceName}"]`).first().waitFor({ state: "visible", timeout });
  }
}
