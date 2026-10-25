import type { Page } from "@playwright/test";

import { expect } from "../fixture/base-test";
import { testEnvConfig } from "../fixture/test-env.config";
import { AddCreditsSheetPage } from "../pages/AddCreditsSheetPage";
import { BillingPage } from "../pages/BillingPage";
import { MembersPage } from "../pages/MembersPage";
import { OrganizationSwitcher } from "../pages/OrganizationSwitcher";

const STANDARD_TOP_UP_MIN_AMOUNT_USD = "20";

export const TEST_CARD_NUMBER = "4242424242424242";

export const TEST_CARD_LAST4 = TEST_CARD_NUMBER.slice(-4);

/** Billing shows the full header even while a new user's personal account is still in onboarding. */
export async function createTeam(page: Page, team: string) {
  await page.goto(`${testEnvConfig.BASE_URL}/billing`);
  await new OrganizationSwitcher(page).createOrganization(team);
  await page.waitForURL(url => url.pathname === "/members", { timeout: 30_000 });
  await expect(new MembersPage(page).heading()).toBeVisible({ timeout: 30_000 });
  await expect(new OrganizationSwitcher(page).trigger(team)).toBeVisible();
}

/** A team never gets a trial, so it pays the standard minimum top-up before it can deploy. */
export async function buyMinimumCredits(page: Page) {
  const billing = new BillingPage(page);
  const addCredits = new AddCreditsSheetPage(page);

  await billing.goto();
  await billing.openAddToBalance();
  await addCredits.waitForOpen();
  await addCredits.enterCustomAmount(STANDARD_TOP_UP_MIN_AMOUNT_USD);
  await addCredits.fillStripeAddress({ name: "E2E Test User", line1: "123 Test Street", city: "San Francisco", state: "CA", zip: "94105" });
  await addCredits.fillStripeCard({ number: TEST_CARD_NUMBER, expiry: "12/30", cvc: "123" });
  await addCredits.submit();
  await expect(addCredits.getPurchaseConfirmation()).toBeVisible({ timeout: 90_000 });
  await addCredits.dismissPurchaseConfirmation();
}
