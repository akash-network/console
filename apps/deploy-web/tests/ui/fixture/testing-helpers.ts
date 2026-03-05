import { type Page } from "@playwright/test";

export const clickWalletSelectorDropdown = async (page: Page) => {
  return await page.getByLabel("wallet dropdown").click();
};

export const clickConnectWalletButton = async (page: Page) => {
  await page.getByRole("button", { name: /connect button/i }).click({ timeout: 20_000 });
};

export const clickCopyAddressButton = async (page: Page) => {
  await page.getByRole("button", { name: /akash\.\.\.[a-z0-9]{5}/ }).click();

  const clipboardContents = await page.evaluate(async () => {
    return await navigator.clipboard.readText();
  });

  return clipboardContents;
};
