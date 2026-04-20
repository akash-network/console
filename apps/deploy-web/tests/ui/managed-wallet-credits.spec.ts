import { expect, test } from "./fixture/authenticated-test";
import { AuthPage } from "./pages/AuthPage";
import { BillingPage } from "./pages/BillingPage";
import { HomePage } from "./pages/HomePage";

test.describe("Managed wallet credits", () => {
  test("purchases credits via Add Funds", async ({ page, login }) => {
    test.setTimeout(2 * 60 * 1000);

    const homePage = new HomePage(page);
    const authPage = new AuthPage(page);
    const billingPage = new BillingPage(page);

    await test.step("login", async () => {
      await homePage.goto();
      await homePage.openSignIn();
      await authPage.waitForPage();
      await login();
    });

    await test.step("navigate to billing via Add Funds", async () => {
      await homePage.getAddFundsLink().click();
      await billingPage.waitForPage();
    });

    const balanceBefore = await test.step("read initial balance", async () => {
      await expect(billingPage.getAvailableBalance()).toBeVisible({ timeout: 15_000 });
      const text = await billingPage.getAvailableBalance().textContent();
      return parseFloat(text!.replace(/[$,]/g, ""));
    });

    await test.step("submit payment", async () => {
      const dialog = page.getByRole("dialog", { name: "Add Funds" });
      await expect(dialog.getByText("Add credits")).toBeVisible({ timeout: 10_000 });

      await dialog.getByRole("combobox").click();
      await page.getByRole("option").first().click();

      await dialog.getByRole("spinbutton", { name: /amount/i }).fill("20");
      await billingPage.getPayButton().click();
    });

    await test.step("verify payment success", async () => {
      await expect(page.getByText("Payment Successful!")).toBeVisible({ timeout: 60_000 });
    });

    await test.step("verify balance increased", async () => {
      await expect(async () => {
        const text = await billingPage.getAvailableBalance().textContent();
        const balanceAfter = parseFloat(text!.replace(/[$,]/g, ""));
        expect(balanceAfter).toBeGreaterThanOrEqual(balanceBefore + 20);
      }).toPass({ timeout: 30_000, intervals: [2_000] });
    });
  });
});
