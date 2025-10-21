import type { Locator, Page } from "@playwright/test";

export const getCurrentWalletName = async (page: Page) => {
  const currentWalletSelector = page.getByText(/^Wallet \d+$/).first();
  await currentWalletSelector.waitFor({ state: "visible", timeout: 5000 });
  const currentWalletName = await currentWalletSelector.textContent();

  if (!currentWalletName) {
    throw new Error("Could not retrieve current wallet name");
  }

  return currentWalletName;
};

export const selectDifferentWallet = async (page: Page, currentWalletName: string) => {
  const allWalletOptions = page.getByText(/^Wallet \d+$/);
  await allWalletOptions.first().waitFor({ state: "visible", timeout: 5000 });
  const walletCount = await allWalletOptions.count();

  let differentWallet = null;

  for (let i = 0; i < walletCount; i++) {
    const walletName = await allWalletOptions.nth(i).textContent();

    if (walletName !== currentWalletName) {
      differentWallet = allWalletOptions.nth(i);
      break;
    }
  }

  if (!differentWallet) {
    throw new Error(`Could not find a different wallet to switch to. Current: ${currentWalletName}`);
  }

  await differentWallet.click();

  const confirmedWalletName = await page
    .getByText(/^Wallet \d+$/)
    .first()
    .textContent();

  if (!confirmedWalletName) {
    throw new Error("Wallet switch was not successful");
  }

  return confirmedWalletName;
};

export const clickConnectWalletButton = async (page: Page) => {
  const button = await waitForLocator(page.getByRole("button", { name: /Connect/i }));
  return await button.click();
};

export const waitForLocator = async (locator: Locator) => {
  await locator.waitFor({ state: "visible", timeout: 20_000 });

  return locator;
};
