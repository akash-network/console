import type { NetworkId } from "@akashnetwork/chain-sdk";
import type { Page } from "@playwright/test";

import { approveWalletOperation } from "../fixture/wallet-setup";

export async function selectChainNetwork(page: Page, networkId: NetworkId = "sandbox") {
  await page.getByRole("link", { name: "App Settings" }).click();
  const selectNetworkButton = page.getByLabel("Select Network");
  const selectedNetwork = await selectNetworkButton.locator("xpath=..").textContent();
  if (selectedNetwork?.toLowerCase().includes(networkId)) return;

  await selectNetworkButton.click({ timeout: 20_000 });

  const networkRadioLocator = page.getByLabel(new RegExp(networkId, "i"));
  await networkRadioLocator.click();
  const popupPromise = page
    .context()
    .waitForEvent("page", { timeout: 3_000 })
    .catch(() => null);
  await page.getByRole("button", { name: "Save" }).click();

  // if page doesn't show up after networkidle load state, approval is not needed
  const popupPage = await Promise.race([popupPromise, page.waitForLoadState("networkidle").then(() => null)]);
  await approveWalletOperation(popupPage);
}
