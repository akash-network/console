import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import type { AppNav } from "../pages/AppNav";
import type { BillingPage } from "../pages/BillingPage";
import type { DeployPage } from "../pages/DeployPage";

export interface CreateManagedDeploymentCallbacks {
  onDepositDisabled?: () => Promise<void>;
  onPaymentSuccess?: () => Promise<void>;
  onDepositEnabled?: () => Promise<void>;
  onLeaseValidated?: () => Promise<void>;
}

export async function createManagedDeployment(
  page: Page,
  input: {
    appNav: AppNav;
    deployPage: DeployPage;
    billingPage: BillingPage;
    templateName: string;
  },
  callbacks?: CreateManagedDeploymentCallbacks
) {
  const { appNav, deployPage, billingPage, templateName } = input;

  const openTemplate = async () => {
    await appNav.openDeploy();
    await deployPage.selectTemplate(templateName);
    await page.getByLabel("SDL editor").waitFor({ state: "visible", timeout: 15_000 });
  };

  await openTemplate();

  let depositDialog = await deployPage.openDepositDialog();
  let continueButton = depositDialog.getByRole("button", { name: /^continue$/i });

  const isDisabled = await continueButton.isDisabled();

  if (isDisabled) {
    await callbacks?.onDepositDisabled?.();

    await depositDialog.getByRole("button", { name: /buy credits/i }).click();
    await billingPage.waitForPage();
    await billingPage.submitPayment("20");

    await callbacks?.onPaymentSuccess?.();

    await openTemplate();
    depositDialog = await deployPage.openDepositDialog();
    continueButton = depositDialog.getByRole("button", { name: /^continue$/i });
  }

  await callbacks?.onDepositEnabled?.();
  await continueButton.click();

  await deployPage.createLease();
  await deployPage.validateLease();

  await callbacks?.onLeaseValidated?.();
}

/**
 * Closes the active deployment from its detail page (actions menu → Close → confirm). The actions menu only
 * appears once the deployment is active, so it is awaited first; the menu disappearing confirms the close.
 * Used as cleanup by the deployment-creating specs so a run leaves no live deployment on the shared account.
 */
export async function closeActiveDeployment(page: Page) {
  const actions = page.getByRole("button", { name: "Deployment actions" });
  await actions.waitFor({ state: "visible", timeout: 120_000 });
  await actions.click();
  await page.getByRole("menuitem", { name: "Close deployment" }).click();
  await page.getByRole("button", { name: /^confirm$/i }).click();
  await expect(actions).toBeHidden({ timeout: 60_000 });
}
