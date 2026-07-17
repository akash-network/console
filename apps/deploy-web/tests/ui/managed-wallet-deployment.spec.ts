import { createManagedDeployment } from "./actions/deploy";
import { skipIfOnboardingRedesign } from "./actions/feature-flags";
import { expect, test } from "./fixture/base-test";
import { AppNav } from "./pages/AppNav";
import { BillingPage } from "./pages/BillingPage";
import { DeployPage } from "./pages/DeployPage";

test.describe("Managed wallet deployment", () => {
  test.use({ userType: "existing" });

  test.beforeEach(async ({ page }) => {
    await skipIfOnboardingRedesign(page);
  });

  test("creates and closes a hello-world deployment", async ({ context, page }) => {
    test.setTimeout(3 * 60 * 1000);

    const billingPage = new BillingPage(page);
    const appNav = new AppNav(page);
    const deployPage = new DeployPage(context, page);

    await test.step("create deployment", async () => {
      await createManagedDeployment(
        page,
        { appNav, deployPage, billingPage, templateName: "Hello World" },
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
