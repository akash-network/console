import { isOnboardingRedesignAvailable } from "./actions/feature-flags";
import { expect, test } from "./fixture/base-test";
import { AddCreditsSheetPage } from "./pages/AddCreditsSheetPage";
import { OnboardingPickerPage } from "./pages/OnboardingPickerPage";

test.describe("Onboarding picker — unlocking the gated LLM template via Add Credits", () => {
  test.use({ userType: "new" });

  test("a fresh trialing user unlocks the LLM template by purchasing credits", async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    expect(await isOnboardingRedesignAvailable(page), "console_onboarding_redesign must be enabled in the test environment").toBe(true);

    const onboardingPickerPage = new OnboardingPickerPage(page);
    const addCreditsSheet = new AddCreditsSheetPage(page);

    await test.step("the gated LLM template CTA reads 'Unlock full trial to deploy' once the trial is active", async () => {
      await expect(onboardingPickerPage.getLlmChatbotCta()).toHaveText(/unlock full trial to deploy/i, { timeout: 60_000 });
    });

    await test.step("clicking the gated CTA opens the Add Credits sheet", async () => {
      await onboardingPickerPage.clickLlmChatbotCta();
      await addCreditsSheet.waitForOpen();
    });

    await test.step("submit a $100 credit purchase with a test card", async () => {
      await addCreditsSheet.pickPredefinedAmount("100");
      await addCreditsSheet.fillStripeAddress({
        name: "E2E Test User",
        line1: "123 Test Street",
        city: "San Francisco",
        state: "CA",
        zip: "94105"
      });
      await addCreditsSheet.fillStripeCard({ number: "4242424242424242", expiry: "12/30", cvc: "123" });
      await addCreditsSheet.submit();
    });

    await test.step("the Add Credits sheet stays open while the payment is being processed", async () => {
      await expect(page.getByText("Processing payment...")).toBeVisible({ timeout: 30_000 });
      await expect(addCreditsSheet.getDialog()).toBeVisible();
    });

    await test.step("snackbars appear in order: processing → successful → welcome", async () => {
      await expect(page.getByText("Processing payment...")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Payment successful!")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Welcome to Akash!")).toBeVisible({ timeout: 30_000 });
    });

    await test.step("the Add Credits sheet closes once the trial flips", async () => {
      await expect(addCreditsSheet.getDialog()).toBeHidden({ timeout: 30_000 });
    });

    await test.step("the LLM template starts deploying", async () => {
      await expect(page.getByText("Deploying")).toBeVisible();
    });
  });
});
