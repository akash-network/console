import { expect, test } from "./fixture/base-test";
import { AlertsPage } from "./pages/AlertsPage";
import { AppNav } from "./pages/AppNav";
import { ConfigureDeploymentPage } from "./pages/ConfigureDeploymentPage";
import { DeploymentAlertsForm } from "./pages/DeploymentAlertsForm";
import { DeploymentDetailPage } from "./pages/DeploymentDetailPage";

test.describe("Managed wallet alerts", () => {
  test.use({ userType: "existing" });

  test("configures deployment alerts and verifies on alerts page", async ({ page }) => {
    test.setTimeout(8 * 60 * 1000);

    const appNav = new AppNav(page);
    const alertsPage = new AlertsPage(page);
    const alertsForm = new DeploymentAlertsForm(page);
    const deploymentDetail = new DeploymentDetailPage(page);
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
      await deploymentDetail.openAlerts();
    });

    await test.step("does not show the escrow balance alert", async () => {
      await expect(page.getByLabel("Escrow Balance")).toHaveCount(0);
    });

    await test.step("verify deployment close alert is enabled by default", async () => {
      await expect(alertsForm.getCloseEnabledToggle()).toBeChecked();
      await expect(alertsForm.getCloseChannelSelect()).toBeVisible();
    });

    await test.step("verify alerts on global alerts page", async () => {
      await appNav.openAlerts();
      await alertsPage.waitForPage();
      await alertsPage.openAlertsTab();
    });

    const deploymentAlertRow = await alertsPage.findAlertRowByDseq(dseq!);

    await test.step("has no escrow threshold rows", async () => {
      await expect(page.getByText("Escrow Threshold")).toHaveCount(0);
    });

    await test.step("toggle alert from alerts list", async () => {
      const toggle = alertsPage.getAlertToggle(deploymentAlertRow);

      await toggle.click();
      await expect(toggle).not.toBeChecked({ timeout: 5_000 });

      await toggle.click();
      await expect(toggle).toBeChecked({ timeout: 5_000 });
    });
  });
});
