import type { NetworkId } from "@akashnetwork/chain-sdk";
import type { Page } from "@playwright/test";

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
    .waitForEvent("page", { timeout: 5_000 })
    .catch(() => null);
  await page.getByRole("button", { name: "Save" }).click();

  const popupPage = await popupPromise;
  await popupPage?.getByRole("button", { name: /Approve/i }).click();
}
