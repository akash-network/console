import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** The detail page only paints its tab bar once the deployment and its leases resolve, which is slow on beta. */
const LAYOUT_TIMEOUT_MS = 120_000;

/**
 * The deployment detail page, which renders either the legacy layout or the redesign depending on the
 * `deployment_detail_redesign` Unleash flag. E2E runs against a deployed environment and cannot pin the flag,
 * so every method here resolves the layout at call time and drives whichever one is on screen. Once the
 * redesign is rolled out and the flag is retired, the legacy branches are the only thing to delete.
 */
export class DeploymentDetailPage {
  constructor(readonly page: Page) {}

  /**
   * Both layouts render their whole tab bar unconditionally, but only the redesign has a Settings tab and only
   * legacy has a Leases one. The tab bar appears only once the deployment and its leases have loaded, so this
   * waits for whichever one arrives before deciding — probing an unsettled page would silently pick legacy.
   */
  private async isRedesign() {
    const redesignTab = this.tab("Settings");
    await expect(redesignTab.or(this.tab("Leases")).first()).toBeVisible({ timeout: LAYOUT_TIMEOUT_MS });

    return await redesignTab.isVisible();
  }

  private tab(name: string) {
    return this.page.getByRole("tab", { name });
  }

  /** Alerts have their own tab in legacy and live under Settings → Notifications in the redesign. */
  async openAlerts() {
    await this.tab((await this.isRedesign()) ? "Settings" : "Alerts").click();
    await expect(this.page.getByText("Configure Alerts")).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Waits for the workload to actually serve traffic. Legacy exposes the lease state directly; the redesign
   * derives a per-service status that only reaches "Running" once a replica is available, which is the same
   * signal a live lease carries. The service row is a collapsible button, which distinguishes its badge from
   * the header's deployment-level one — that turns "Running" as soon as the deployment exists.
   */
  async expectRunning(timeout = 60_000) {
    const isRedesign = await this.isRedesign();
    await this.tab(isRedesign ? "Details" : "Leases").click();

    if (isRedesign) {
      await expect(this.serviceRow("Running")).toBeVisible({ timeout });
    } else {
      await expect(this.page.getByLabel("Lease 0 state")).toHaveText("active", { timeout });
    }
  }

  async expectClosed(timeout = 30_000) {
    if (await this.isRedesign()) {
      await expect(this.page.getByText("Closed").first()).toBeVisible({ timeout });
    } else {
      await expect(this.page.getByLabel("Lease 0 state")).toHaveText("closed", { timeout });
    }
  }

  /** A service row is the collapsible trigger on the Details tab, labelled by the service name and its status. */
  private serviceRow(status: string) {
    return this.page.getByRole("button").filter({ hasText: status }).first();
  }

  /**
   * Closes the deployment: from the Settings tab's danger zone in the redesign, from the actions menu in
   * legacy. Either control only appears once the deployment is active, so it is awaited first, and it
   * disappearing once the close lands confirms it. Both layouts share the same confirmation popup.
   */
  async closeDeployment() {
    const trigger = (await this.isRedesign()) ? await this.openDangerZone() : await this.openActionsMenu();

    await expect(this.page.getByText(/are you sure you want to close/i)).toBeVisible({ timeout: 5_000 });
    await this.page.getByRole("button", { name: /^confirm$/i }).click();
    await expect(trigger).toBeHidden({ timeout: 60_000 });
  }

  private async openDangerZone() {
    await this.tab("Settings").click();
    const close = this.page.getByRole("button", { name: "Close deployment" });
    await close.waitFor({ state: "visible", timeout: 120_000 });
    await close.click();

    return close;
  }

  private async openActionsMenu() {
    const actions = this.page.getByRole("button", { name: /deployment actions/i });
    await actions.waitFor({ state: "visible", timeout: 120_000 });
    await actions.click();
    await this.page.getByRole("menuitem", { name: /close deployment/i }).click();

    return actions;
  }
}
