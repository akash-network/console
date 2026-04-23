import type { Page } from "@playwright/test";

import type { BillingPage } from "../pages/BillingPage";
import type { DeployPage } from "../pages/DeployPage";
import type { Sidebar } from "../pages/Sidebar";

export interface CreateManagedDeploymentCallbacks {
  onDepositDisabled?: () => Promise<void>;
  onPaymentSuccess?: () => Promise<void>;
  onDepositEnabled?: () => Promise<void>;
  onLeaseValidated?: () => Promise<void>;
}

export async function createManagedDeployment(
  page: Page,
  input: {
    sidebar: Sidebar;
    deployPage: DeployPage;
    billingPage: BillingPage;
    templateName: string;
  },
  callbacks?: CreateManagedDeploymentCallbacks
) {
  const { sidebar, deployPage, billingPage, templateName } = input;

  const openTemplate = async () => {
    await sidebar.openDeploy();
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
