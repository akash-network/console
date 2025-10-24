import type { Locator, Page } from "@playwright/test";

export const clickWalletSelectorDropdown = async (page: Page) => {
  return await page.getByLabel("wallet dropdown")?.click();
};

export const clickCreateNewWalletButton = async (page: Page) => {
  const createOrImportButton = page.getByText(/create \/ import wallet/i);
  await createOrImportButton.waitFor({ state: "visible", timeout: 10_000 });
  await createOrImportButton.click();

  const createNewWalletButton = page.getByText(/create new wallet/i);
  await createNewWalletButton.waitFor({ state: "visible", timeout: 10_000 });
  await createNewWalletButton.click();
};

export const fillWalletName = async (page: Page, name: string) => {
  const input = await waitForLocator(page.getByPlaceholder("Enter wallet Name"));
  return await input.fill(name);
};

export const clickCreateWalletButton = async (page: Page) => {
  const button = await waitForLocator(page.getByRole("button", { name: /Create Wallet/i }));
  return await button.click();
};

export const clickConnectWalletButton = async (page: Page) => {
  const button = await waitForLocator(page.getByRole("button", { name: /connect button/i }));
  return await button.click();
};

export const waitForLocator = async (locator: Locator) => {
  await locator.waitFor({ state: "visible", timeout: 20_000 });
  return locator;
};
