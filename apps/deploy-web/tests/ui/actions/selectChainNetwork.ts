import type { Page } from "@playwright/test";

import { waitForLocator } from "../fixture/testing-helpers";
import { approveWalletOperation } from "../fixture/wallet-setup";

export async function selectChainNetwork(page: Page, networkId = "sandbox") {
  await page.getByRole("link", { name: "App Settings" }).click();

  const selectNetworkButton = await waitForLocator(page.getByLabel("Select Network"));
  await selectNetworkButton.click();

  await page.getByLabel(new RegExp(networkId, "i")).click();

  const popupPromise = page.context().waitForEvent("page", { timeout: 5000 });
  await page.getByRole("button", { name: "Save" }).click();

  const popupPage = await popupPromise;

  await approveWalletOperation(popupPage);
}
