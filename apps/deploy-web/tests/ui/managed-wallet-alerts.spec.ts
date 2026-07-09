import { skipUnlessOnboardingRedesign } from "./actions/feature-flags";
import { expect, test } from "./fixture/base-test";
import { AlertsPage } from "./pages/AlertsPage";
import { ConfigureDeploymentPage } from "./pages/ConfigureDeploymentPage";
import { DeploymentAlertsForm } from "./pages/DeploymentAlertsForm";
import { DeployPage } from "./pages/DeployPage";
import { Sidebar } from "./pages/Sidebar";

test.describe("Managed wallet alerts", () => {
  test.use({ userType: "existing" });

  test.beforeEach(async ({ page }) => {
    await skipUnlessOnboardingRedesign(page);
  });

  test("configures deployment alerts and verifies on alerts page", async ({ context, page }) => {
    test.setTimeout(8 * 60 * 1000);

    const sidebar = new Sidebar(page);
    const alertsPage = new AlertsPage(page);
    const alertsForm = new DeploymentAlertsForm(page);
    const deployPage = new DeployPage(context, page);
    const configure = new ConfigureDeploymentPage(page);

    let dseq: string;

    await test.step("deploy a container through the configure flow", async () => {
      await configure.open();
      await configure.fillImageName("nginx:latest");
      await configure.requestQuotes();
      await page.waitForURL(/\/new-deployment\/configure\/\d+/, { timeout: 180_000 });

      await configure.selectFirstAvailableProvider();
      await expect(configure.reviewDialog()).toBeVisible({ timeout: 30_000 });
      await configure.confirmAndDeploy();
      await page.waitForURL(/\/deployments\/\d+/, { timeout: 180_000 });

      const match = page.url().match(/deployments\/(\d+)/);
      if (!match) throw new Error(`Could not extract DSEQ from URL: ${page.url()}`);
      dseq = match[1];
    });

    await test.step("open deployment alerts tab", async () => {
      await deployPage.openTab("Alerts");
      await expect(page.getByText("Configure Alerts")).toBeVisible({ timeout: 10_000 });
    });

    await test.step("verify escrow balance alert is NOT enabled by default", async () => {
      await expect(alertsForm.getEscrowEnabledToggle()).not.toBeChecked();
      await expect(alertsForm.getEscrowThresholdInput()).toBeVisible();
      await expect(alertsForm.getEscrowChannelSelect()).toBeVisible();
    });

    await test.step("verify deployment close alert is enabled by default", async () => {
      await expect(alertsForm.getCloseEnabledToggle()).toBeChecked();
      await expect(alertsForm.getCloseChannelSelect()).toBeVisible();
    });

    await test.step("enable escrow balance alert, update threshold, and save", async () => {
      await alertsForm.getEscrowEnabledToggle().click();
      await expect(alertsForm.getEscrowEnabledToggle()).toBeChecked();

      const originalValue = await alertsForm.getEscrowThresholdInput().inputValue();
      const newThreshold = Math.max(0.01, parseFloat(originalValue) * 0.5).toFixed(3);

      await alertsForm.setEscrowThreshold(newThreshold);
      await alertsForm.saveChanges();

      await expect(alertsForm.getEscrowThresholdInput()).toHaveValue(newThreshold);
    });

    await test.step("disable escrow balance alert and save", async () => {
      await alertsForm.getEscrowEnabledToggle().click();
      await expect(alertsForm.getEscrowEnabledToggle()).not.toBeChecked();
      await alertsForm.saveChanges();
    });

    await test.step("re-enable escrow balance alert and save", async () => {
      await alertsForm.getEscrowEnabledToggle().click();
      await expect(alertsForm.getEscrowEnabledToggle()).toBeChecked();
      await alertsForm.saveChanges();
    });

    await test.step("verify alerts on global alerts page", async () => {
      await sidebar.openAlerts();
      await alertsPage.waitForPage();
      await alertsPage.openAlertsTab();
    });

    const deploymentAlertRow = await alertsPage.findAlertRowByDseq(dseq!);

    await test.step("toggle alert from alerts list", async () => {
      const toggle = alertsPage.getAlertToggle(deploymentAlertRow);

      await toggle.click();
      await expect(toggle).not.toBeChecked({ timeout: 5_000 });

      await toggle.click();
      await expect(toggle).toBeChecked({ timeout: 5_000 });
    });

    await test.step("close deployment", async () => {
      await deploymentAlertRow.getByRole("link").first().click();
      await deployPage.closeDeployment();
      await expect(page.getByText(/are you sure you want to close/i)).toBeVisible({ timeout: 5_000 });
      await page.getByRole("button", { name: /confirm/i }).click();
    });
  });
});
