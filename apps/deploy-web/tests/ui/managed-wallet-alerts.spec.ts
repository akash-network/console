import { createManagedDeployment } from "./actions/deploy";
import { expect, test } from "./fixture/authenticated-test";
import { AlertsPage } from "./pages/AlertsPage";
import { AuthPage } from "./pages/AuthPage";
import { BillingPage } from "./pages/BillingPage";
import { DeploymentAlertsForm } from "./pages/DeploymentAlertsForm";
import { DeployPage } from "./pages/DeployPage";
import { HomePage } from "./pages/HomePage";
import { Sidebar } from "./pages/Sidebar";

test.describe("Managed wallet alerts", () => {
  test("configures deployment alerts and verifies on alerts page", async ({ context, page, login }) => {
    test.setTimeout(4 * 60 * 1000);

    const homePage = new HomePage(page);
    const authPage = new AuthPage(page);
    const sidebar = new Sidebar(page);
    const alertsPage = new AlertsPage(page);
    const alertsForm = new DeploymentAlertsForm(page);
    const billingPage = new BillingPage(page);
    const deployPage = new DeployPage(context, page, { walletType: "api" });

    await test.step("login", async () => {
      await homePage.goto();
      await homePage.openSignIn();
      await authPage.waitForPage();
      await login();
    });

    let dseq: string;

    await test.step("deploy hello-world", async () => {
      await createManagedDeployment(
        page,
        { sidebar, deployPage, billingPage, templateName: "Hello World" },
        {
          onPaymentSuccess: async () => {
            await expect(page.getByText("Payment Successful!")).toBeVisible({ timeout: 60_000 });
            await expect(page.getByText("Payment Successful!")).toBeHidden({ timeout: 30_000 });
          },
          onDepositEnabled: async () => {
            await expect(deployPage.page.getByRole("button", { name: /^continue$/i })).toBeEnabled({ timeout: 30_000 });
          }
        }
      );

      const match = page.url().match(/deployments\/(\d+)/);
      if (!match) throw new Error(`Could not extract DSEQ from URL: ${page.url()}`);
      dseq = match[1];
    });

    await test.step("open deployment alerts tab", async () => {
      await deployPage.openTab("Alerts");
      await expect(page.getByText("Configure Alerts")).toBeVisible({ timeout: 10_000 });
    });

    await test.step("verify escrow balance alert is enabled by default", async () => {
      await expect(alertsForm.getEscrowEnabledToggle()).toBeChecked();
      await expect(alertsForm.getEscrowThresholdInput()).toBeVisible();
      await expect(alertsForm.getEscrowChannelSelect()).toBeVisible();
    });

    await test.step("verify deployment close alert is enabled by default", async () => {
      await expect(alertsForm.getCloseEnabledToggle()).toBeChecked();
      await expect(alertsForm.getCloseChannelSelect()).toBeVisible();
    });

    await test.step("update escrow threshold and save", async () => {
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
      await expect(alertsPage.getAlertRow(0)).toBeVisible({ timeout: 10_000 });
    });

    await test.step("toggle alert from alerts list", async () => {
      const firstAlertRow = alertsPage.getAlertRow(0);
      const toggle = alertsPage.getAlertToggle(firstAlertRow);

      await toggle.click();
      await expect(toggle).not.toBeChecked({ timeout: 5_000 });

      await toggle.click();
      await expect(toggle).toBeChecked({ timeout: 5_000 });
    });

    await test.step("close deployment", async () => {
      await page.getByRole("row").filter({ hasText: dseq }).getByRole("link").first().click();
      await deployPage.closeDeployment();
      await expect(page.getByText(/are you sure you want to close/i)).toBeVisible({ timeout: 5_000 });
      await page.getByRole("button", { name: /confirm/i }).click();
    });
  });
});
