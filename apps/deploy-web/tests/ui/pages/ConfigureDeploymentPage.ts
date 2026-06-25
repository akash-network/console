import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";

/**
 * Drives the "Configure your deployment" screen and its quoting lifecycle: configure a spec, request
 * quotes (creates the deployment), then cancel-and-edit (closes it). Interactions only — assertions live
 * in the spec.
 */
export class ConfigureDeploymentPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}/new-deployment/configure`);
    await this.page.getByRole("heading", { name: "Configure your deployment" }).waitFor({ state: "visible", timeout: 15_000 });
  }

  async fillImageName(image: string) {
    await this.dockerImageInput().fill(image);
  }

  async requestQuotes() {
    await this.requestQuotesButton().click();
  }

  async cancelAndEdit() {
    await this.page.getByRole("button", { name: "Cancel and edit" }).first().click();
  }

  dockerImageInput() {
    return this.page.getByRole("textbox", { name: "Docker image" });
  }

  cpuInput() {
    return this.page.getByRole("spinbutton", { name: "CPU Count" });
  }

  requestQuotesButton() {
    return this.page.getByRole("button", { name: "Request quotes" });
  }

  /** The lock banner copy shown in each spec pane while quotes are active. */
  lockBannerText() {
    return this.page.getByText("Changes here invalidate the active quotes.");
  }

  marketplaceHeading() {
    return this.page.getByRole("heading", { name: /Compute Marketplace/i });
  }
}
