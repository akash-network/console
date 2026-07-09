import { skipIfOnboardingRedesign } from "./actions/feature-flags";
import { expect, test } from "./fixture/base-test";
import { OnboardingPage } from "./pages/OnboardingPage";

test.describe("Managed wallet onboarding", () => {
  test.use({ userType: "new" });

  test.beforeEach(async ({ page }) => {
    await skipIfOnboardingRedesign(page);
  });

  test("completes full onboarding from free trial to welcome", async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);

    const onboardingPage = new OnboardingPage(page);

    await test.step("begin free trial onboarding", async () => {
      const startFreeTrialBtn = page.getByRole("button", { name: /start free trial/i });
      const addPaymentBtn = onboardingPage.getAddPaymentMethodButton();

      await Promise.any([startFreeTrialBtn.waitFor({ state: "visible", timeout: 30_000 }), addPaymentBtn.waitFor({ state: "visible", timeout: 30_000 })]);

      if (await addPaymentBtn.isVisible()) return;
      await startFreeTrialBtn.click();
    });

    await test.step("add payment method via Stripe", async () => {
      await expect(onboardingPage.getAddPaymentMethodButton()).toBeVisible({ timeout: 30_000 });

      await onboardingPage.fillStripeAddress({
        name: "E2E Test User",
        line1: "123 Test Street",
        city: "San Francisco",
        state: "CA",
        zip: "94105"
      });

      await onboardingPage.fillStripeCard({
        number: "4242424242424242",
        expiry: "12/30",
        cvc: "123"
      });

      await onboardingPage.submitPaymentMethod();
    });

    await test.step("start trial", async () => {
      await expect(onboardingPage.getStartTrialButton()).toBeVisible({ timeout: 30_000 });
      await onboardingPage.getStartTrialButton().click();
    });

    await test.step("verify welcome step shows trial credits", async () => {
      await expect(onboardingPage.getWelcomeHeading()).toBeVisible({ timeout: 60_000 });
      await expect(onboardingPage.getTrialActiveBadge()).toBeVisible();
      await expect(onboardingPage.getTrialCreditsText()).toBeVisible();
    });
  });
});
