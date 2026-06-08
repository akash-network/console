import { expect, test } from "./fixture/base-test";
import { BillingPage } from "./pages/BillingPage";
import { HomePage } from "./pages/HomePage";

const TOP_UP_AMOUNT = 100;

test.describe("Managed wallet credits", () => {
  test.use({ userType: "existing" });

  test("purchases credits via Add Funds", async ({ page }) => {
    test.setTimeout(2 * 60 * 1000);

    const homePage = new HomePage(page);
    const billingPage = new BillingPage(page);

    await test.step("navigate to billing via Add Funds", async () => {
      await homePage.getAddFundsLink().click();
      await billingPage.waitForPage();
    });

    const balanceBefore = await test.step("read initial balance", async () => {
      await expect(billingPage.getAvailableBalance()).toBeVisible({ timeout: 15_000 });
      const text = await billingPage.getAvailableBalance().textContent();
      return parseBalance(text);
    });

    await test.step("submit payment", async () => {
      await billingPage.submitPayment(String(TOP_UP_AMOUNT));
    });

    await test.step("verify payment success", async () => {
      await expect(page.getByText("Payment Successful!")).toBeVisible({ timeout: 60_000 });
    });

    await test.step("verify balance increased", async () => {
      await expect(async () => {
        const text = await billingPage.getAvailableBalance().textContent();
        const balanceAfter = parseBalance(text);
        expect(balanceAfter).toBeGreaterThanOrEqual(balanceBefore + TOP_UP_AMOUNT);
      }).toPass({ timeout: 30_000, intervals: [2_000] });
    });
  });
});

function parseBalance(raw: string | null): number {
  const normalized = (raw ?? "").replace(/[^\d.-]/g, "");
  const value = Number.parseFloat(normalized);

  if (!Number.isFinite(value)) {
    throw new Error(`Unable to parse balance from "${raw}"`);
  }

  return value;
}
