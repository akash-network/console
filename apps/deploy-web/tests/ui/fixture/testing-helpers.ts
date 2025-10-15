import type { Locator, Page } from "@playwright/test";

export const getWalletSelectorDropdown = async (page: Page) => {
  const buttons = await page.$$("#popup-layout button");
  return buttons.length ? buttons[0] : null;
};

export const clickWalletSelectorDropdown = async (page: Page) => {
  return (await getWalletSelectorDropdown(page))?.click();
};

export const clickCreateNewWalletButton = async (page: Page) => {
  const createNewWalletButton = page.getByText(/create new wallet/i);
  await createNewWalletButton.waitFor({ state: "visible", timeout: 10_000 });
  await createNewWalletButton.click();
};

export const fillWalletName = async (page: Page, name: string) => {
  const input = await waitForSelector(page, 'input[placeholder="Enter wallet Name"]');
  return await input.fill(name);
};

export const clickCreateWalletButton = async (page: Page) => {
  const button = await waitForSelector(page, 'button:has-text("Create Wallet")');
  return await button.click();
};

export const clickConnectWalletButton = async (page: Page) => {
  const button = await waitForSelector(page, 'button:has-text("Connect")');
  return await button.click();
};

const waitForSelector = async (page: Page, selector: string) => {
  return waitForLocator(page.locator(selector));
};

export const waitForLocator = async (locator: Locator) => {
  await locator.waitFor({ state: "visible", timeout: 20_000 });

  return locator;
};
