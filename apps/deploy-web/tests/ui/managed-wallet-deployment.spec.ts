import { expect, test } from "./fixture/authenticated-test";
import { AuthPage } from "./pages/AuthPage";
import { BillingPage } from "./pages/BillingPage";
import { DeployPage } from "./pages/DeployPage";
import { HomePage } from "./pages/HomePage";
import { Sidebar } from "./pages/Sidebar";

test.describe("Managed wallet deployment", () => {
  test("creates and closes a hello-world deployment", async ({ context, page, login }) => {
    test.setTimeout(3 * 60 * 1000);

    const homePage = new HomePage(page);
    const authPage = new AuthPage(page);
    const billingPage = new BillingPage(page);
    const sidebar = new Sidebar(page);
    const deployPage = new DeployPage(context, page, { walletType: "api" });

    await test.step("login", async () => {
      await homePage.goto();
      await homePage.openSignIn();
      await authPage.waitForPage();
      await login();
    });

    await test.step("select hello-world template", async () => {
      await openHelloWorldTemplate();
    });

    await test.step("create deployment", async () => {
      let depositDialog = await deployPage.openDepositDialog();
      let continueButton = depositDialog.getByRole("button", { name: /^continue$/i });

      const needsTopUp = await expect(continueButton)
        .toBeDisabled({ timeout: 10_000 })
        .then(
          () => true,
          () => false
        );

      if (needsTopUp) {
        await depositDialog.getByRole("button", { name: /buy credits/i }).click();
        await billingPage.waitForPage();
        await billingPage.submitPayment("20");
        await expect(page.getByText("Payment Successful!")).toBeVisible({ timeout: 60_000 });
        await expect(page.getByText("Payment Successful!")).toBeHidden({ timeout: 30_000 });

        await openHelloWorldTemplate();
        depositDialog = await deployPage.openDepositDialog();
        continueButton = depositDialog.getByRole("button", { name: /^continue$/i });
      }

      await expect(continueButton).toBeEnabled({ timeout: 30_000 });
      await continueButton.click();
    });

    async function openHelloWorldTemplate() {
      await sidebar.openDeploy();
      await deployPage.selectTemplate("Hello World");
      await page.getByLabel("SDL editor").waitFor({ state: "visible", timeout: 15_000 });
    }

    await test.step("select provider and create lease", async () => {
      await deployPage.createLease();
    });

    await test.step("verify lease is active", async () => {
      await deployPage.validateLease();
    });

    await test.step("verify auto-deposit is enabled", async () => {
      await expect(page.getByText("Auto top-up")).toBeVisible({ timeout: 10_000 });
    });

    await test.step("close deployment", async () => {
      await deployPage.closeDeployment();
      await expect(page.getByText(/are you sure you want to close/i)).toBeVisible({ timeout: 5_000 });
      await page.getByRole("button", { name: /confirm/i }).click();
    });

    await test.step("verify deployment is closed", async () => {
      await expect(page.getByLabel("Lease 0 state")).toHaveText("closed", { timeout: 30_000 });
    });
  });
});
