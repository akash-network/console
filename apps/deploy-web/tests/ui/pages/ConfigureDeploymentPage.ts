import type { Download, Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";
import { AppNav } from "./AppNav";

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

  /**
   * Reaches the configure screen the way a user does — from the app home, opening the Deploy entry in whichever
   * nav is rendered (the classic deployment-type/template picker), then choosing "Run Custom Container" (bring
   * your own image), which routes on to configure — rather than deep-linking to the URL.
   */
  async open() {
    await this.openFromPicker("Run Custom Container");
  }

  /** The Container-VM entry: the same picker walk through the card that seeds an SSH-accessible linux VM. */
  async openContainerVm() {
    await this.openFromPicker("Launch Container-VM");
  }

  /** The legacy Container-VM URL, kept alive for old links and bookmarks; it redirects onto configure. */
  async gotoDeployLinux() {
    await this.page.goto(`${testEnvConfig.BASE_URL}/deploy-linux`);
    await this.page.getByRole("heading", { name: "Configure your deployment" }).waitFor({ state: "visible", timeout: 30_000 });
  }

  /**
   * Answers deployment creation locally and records every attempt, so a submit can be driven against a deployed
   * environment with no chance of putting a deployment on chain even if the form's own guards regress.
   */
  async blockDeploymentCreation(): Promise<string[]> {
    const attempts: string[] = [];

    await this.page.route(/\/api\/proxy\/v1\/deployments(\?|$)/, async route => {
      if (route.request().method() !== "POST") {
        return route.fallback();
      }

      attempts.push(route.request().postData() ?? "");
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "blocked by e2e" }) });
    });

    return attempts;
  }

  /** The picker cards are divs carrying only an aria-label, so getByLabel is the locator that reaches them. */
  private async openFromPicker(cardLabel: string) {
    await this.page.goto(`${testEnvConfig.BASE_URL}/`, { waitUntil: "commit" });
    await new AppNav(this.page).openDeploy();
    await this.page.getByLabel(cardLabel).click({ timeout: 60_000 });
    await this.page.getByRole("heading", { name: "Configure your deployment" }).waitFor({ state: "visible", timeout: 30_000 });
  }

  async reload() {
    await this.page.reload();
    await this.page.getByRole("heading", { name: "Configure your deployment" }).waitFor({ state: "visible", timeout: 15_000 });
  }

  async fillImageName(image: string) {
    await this.dockerImageInput().fill(image);
  }

  async selectDistro(distro: string) {
    await this.distributionSelect().click();
    await this.page.getByRole("option", { name: distro }).click();
  }

  /** Arms the download listener before the click, since the zip is saved synchronously once the key pair exists. */
  async generateSshKeys(): Promise<Download> {
    const download = this.page.waitForEvent("download", { timeout: 30_000 });
    await this.page.getByRole("button", { name: "Generate new key" }).click();
    return download;
  }

  /** The SDL persisted for the active configure draft, or null when none has been written yet. */
  getPersistedDraft() {
    return this.page.evaluate(() => {
      const key = Object.keys(window.localStorage).find(item => item.startsWith("configure-draft:"));
      return key ? window.localStorage.getItem(key) : null;
    });
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

  /** The image card, which is titled "Operating System" instead of "Docker" for a Container-VM service. */
  operatingSystemCard() {
    return this.page.getByRole("button", { name: /(Collapse|Expand) Operating System/ });
  }

  distributionSelect() {
    return this.page.getByRole("combobox", { name: "Distribution" });
  }

  exposeSshCheckbox() {
    return this.page.getByRole("checkbox", { name: "Expose SSH" });
  }

  sshPublicKeyInput() {
    return this.page.getByRole("textbox", { name: "SSH public key" });
  }

  sshKeyRequiredError() {
    return this.page.getByText("SSH Public key is required.");
  }

  cpuInput() {
    return this.page.getByRole("spinbutton", { name: "CPU Count" });
  }

  requestQuotesButton() {
    return this.page.getByRole("button", { name: "Request quotes" });
  }

  cancellingButton() {
    return this.page.getByRole("button", { name: "Cancelling", exact: true });
  }

  /** The lock banner copy shown in each spec pane while quotes are active. */
  lockBannerText() {
    return this.page.getByText("Changing a locked setting needs new quotes.");
  }

  marketplaceHeading() {
    return this.page.getByRole("heading", { name: /Compute Marketplace/i });
  }

  /** The marketplace pane region — used to scope provider rows away from the deployment pane's "Select service-N" buttons. */
  marketplace() {
    return this.page.getByRole("region", { name: /Compute Marketplace/i });
  }

  /** Waits for the first submitted bid's Select button in the marketplace, then picks it. */
  async selectFirstAvailableProvider() {
    const select = this.marketplace()
      .getByRole("button", { name: /^Select / })
      .first();
    await select.click({ timeout: 90_000 });
  }

  reviewDialog() {
    return this.page.getByRole("dialog");
  }

  async confirmAndDeploy() {
    await this.reviewDialog()
      .getByRole("button", { name: /confirm and deploy/i })
      .click();
  }
}
