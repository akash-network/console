import { type BrowserContext, type Page, selectors } from "@playwright/test";

const WALLET_PASSWORD = "12345678";

export const setupLeap = async (context: BrowserContext, page: Page) => {
  page.waitForLoadState("domcontentloaded");
  selectors.setTestIdAttribute("data-testing-id");

  await page.getByTestId("import-seed-phrase").click();

  const mnemonic = process.env.TEST_WALLET_MNEMONIC;
  if (!mnemonic) {
    throw new Error("TEST_WALLET_MNEMONIC is not set");
  }
  const mnemonicArray = mnemonic.split(" ");

  for (let i = 0; i < mnemonicArray.length; i++) {
    await page.locator(`//*[@id="root"]/div/div[2]/div/div[1]/div[1]/div/div[2]/div[${i + 1}]`).click();
    await page.locator("input").last().fill(mnemonicArray[i]);
  }

  await page.getByTestId("btn-import-wallet").click();

  // Select wallet
  await page.getByTestId("wallet-1").click();
  await page.getByTestId("btn-select-wallet-proceed").click();

  // Set password
  await page.getByTestId("input-password").fill(WALLET_PASSWORD);
  await page.getByTestId("input-confirm-password").fill(WALLET_PASSWORD);
  await page.getByTestId("btn-password-proceed").click();

  await page.waitForLoadState("domcontentloaded");

  // Reset test id attribute for console
  selectors.setTestIdAttribute("data-testid");

  await page.goto("http://localhost:3000");

  await page.getByTestId("welcome-modal-accept-button").click();
  await page.getByTestId("connect-wallet-btn").click();

  await page.getByRole("button", { name: "Leap Leap" }).click();

  // Connect to Leap
  const popupPage = await context.waitForEvent("page");
  await popupPage.waitForLoadState("domcontentloaded");

  if (await popupPage.isVisible("text=Unlock wallet", { timeout: 5000 })) {
    await page.locator("input").fill(WALLET_PASSWORD);
    await popupPage.getByRole("button", { name: "Unlock wallet" }).click();
  }

  await popupPage.getByRole("button", { name: "Connect" }).click();

  // await page.pause();
};
