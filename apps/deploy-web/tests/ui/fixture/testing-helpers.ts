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
  return await page.getByPlaceholder("Enter wallet Name").fill(name);
};

export const clickCreateWalletButton = async (page: Page) => {
  const button = await waitForLocator(page.getByRole("button", { name: /Create Wallet/i }));
  return await button.click();
};

export const clickConnectWalletButton = async (page: Page) => {
  const button = await waitForLocator(page.getByRole("button", { name: /connect button/i }));
  return await button.click();
};

export const getCopyAddressButton = async (page: Page) => {
  const buttons = await page.$$("#popup-layout button");
  return buttons.length ? buttons[1] : null;
};

export const clickCopyAddressButton = async (page: Page) => {
  const button = await getCopyAddressButton(page);
  await button?.click();

  const clipboardContents = await page.evaluate(async () => {
    return await navigator.clipboard.readText();
  });

  return clipboardContents;
};

export const waitForLocator = async (locator: Locator) => {
  await locator.waitFor({ state: "visible", timeout: 20_000 });
  return locator;
};
