import { expect } from "@playwright/test";

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

  async verifyPreviewSdlContains(text: string) {
    await expect(this.page.getByText(text).first()).toBeVisible();
  }

  async closePreview() {
    await this.page.getByRole("button", { name: /close/i }).first().click();
  }

  async verifyImageNameValue(value: string) {
    await expect(this.page.getByTestId("image-name-input")).toHaveValue(value);
  }
}
