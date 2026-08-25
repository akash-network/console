import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** The detail page only paints its tab bar once the deployment and its leases resolve, which is slow on beta. */
const LAYOUT_TIMEOUT_MS = 120_000;

/** The deployment detail page. Every method waits for the tab bar, which appears only once the deployment and its leases have loaded. */
export class DeploymentDetailPage {
  constructor(readonly page: Page) {}

  private tab(name: string) {
    return this.page.getByRole("tab", { name });
  }

  /** Alerts live under Settings → Notifications. */
  async openAlerts() {
    const settingsTab = this.tab("Settings");
    await expect(settingsTab).toBeVisible({ timeout: LAYOUT_TIMEOUT_MS });
    await settingsTab.click();
    await expect(this.page.getByText("Configure Alerts")).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Waits for the workload to actually serve traffic. The per-service status only reaches "Running" once a
   * replica is available, which is the same signal a live lease carries. The service row is a collapsible
   * button, which distinguishes its badge from the header's deployment-level one — that turns "Running" as
   * soon as the deployment exists.
   */
  async expectRunning(timeout = 60_000) {
    const detailsTab = this.tab("Details");
    await expect(detailsTab).toBeVisible({ timeout: LAYOUT_TIMEOUT_MS });
    await detailsTab.click();
    await expect(this.serviceRow("Running")).toBeVisible({ timeout });
  }

  async expectClosed(timeout = 30_000) {
    await expect(this.page.getByText("Closed").first()).toBeVisible({ timeout });
  }

  /** A service row is the collapsible trigger on the Details tab, labelled by the service name and its status. */
  private serviceRow(status: string) {
    return this.page.getByRole("button").filter({ hasText: status }).first();
  }

  /**
   * Closes the deployment from the Settings tab's danger zone. The close button only appears once the
   * deployment is active, so it is awaited first, and it disappearing once the close lands confirms it.
   */
  async closeDeployment() {
    const trigger = await this.openDangerZone();

    await expect(this.page.getByText(/are you sure you want to close/i)).toBeVisible({ timeout: 5_000 });
    await this.page.getByRole("button", { name: /^confirm$/i }).click();
    await expect(trigger).toBeHidden({ timeout: 60_000 });
  }

  private async openDangerZone() {
    const settingsTab = this.tab("Settings");
    await expect(settingsTab).toBeVisible({ timeout: LAYOUT_TIMEOUT_MS });
    await settingsTab.click();
    const close = this.page.getByRole("button", { name: "Close deployment" });
    await close.waitFor({ state: "visible", timeout: 120_000 });
    await close.click();

    return close;
  }
}
