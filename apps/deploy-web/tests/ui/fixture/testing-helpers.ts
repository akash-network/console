import type { Locator, Page } from "@playwright/test";

export const clickWalletSelectorDropdown = async (page: Page) => {
  return await page.getByLabel("wallet dropdown")?.click();
};

export const clickConnectWalletButton = async (page: Page) => {
  const button = await waitForLocator(page.getByRole("button", { name: /connect button/i }));
  return await button.click();
};

export const clickCopyAddressButton = async (page: Page) => {
  await page.getByRole("button", { name: /akash\.\.\.[a-z0-9]{5}/ }).click();

  const clipboardContents = await page.evaluate(async () => {
    return await navigator.clipboard.readText();
  });

  return clipboardContents;
};

export const waitForLocator = async (locator: Locator) => {
  await locator.waitFor({ state: "visible", timeout: 20_000 });
  return locator;
};
