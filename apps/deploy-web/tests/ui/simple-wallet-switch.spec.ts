import type { BrowserContext } from "@playwright/test";
import { chromium, selectors } from "@playwright/test";
import { nanoid } from "nanoid";
import path from "path";
import { setTimeout as wait } from "timers/promises";

import { injectUIConfig, test as baseTest } from "./fixture/base-test";
import { testEnvConfig } from "./fixture/test-env.config";
import { connectWalletViaLeap } from "./fixture/wallet-setup";

// Simple fixture to test wallet connection with Leap
const test = baseTest.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const pathToExtension = path.join(__dirname, "fixture", "Leap");
    const contextName = nanoid();
    const userDataDir = path.join(__dirname, "fixture", "testdata", "tmp", contextName);
    const args = [`--disable-extensions-except=${pathToExtension}`, `--load-extension=${pathToExtension}`];

    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      args,
      permissions: ["clipboard-read", "clipboard-write"],
      bypassCSP: true
    });

    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent("serviceworker");
    }

    const extensionId = background.url().split("/")[2];
    await use(extensionId);
  },
  page: async ({ context }, use) => {
    const page = await context.newPage();
    await injectUIConfig(page);
    await page.goto(testEnvConfig.BASE_URL);
    await use(page);
  }
});

test("simple wallet connection test - should reproduce popup error", async ({ context, page, extensionId }) => {
  test.setTimeout(10 * 60 * 1000);

  console.log("Starting simple wallet connection test");
  console.log("This test will try to connect Leap wallet and should show the popup error");

  const screenshotDir = path.join(__dirname, "test-results", "simple-connect-screenshots");

  // Get test wallet mnemonic
  const mnemonic = process.env.TEST_WALLET_MNEMONIC;
  if (!mnemonic) {
    throw new Error("TEST_WALLET_MNEMONIC environment variable is not set");
  }

  // Open Leap extension and import wallet
  const extUrl = `chrome-extension://${extensionId}/index.html`;
  const extPage = await context.newPage();

  try {
    selectors.setTestIdAttribute("data-testing-id");

    await extPage.goto(extUrl, { waitUntil: "domcontentloaded" });
    console.log("Leap extension page opened");
    await wait(2000);

    // Take initial screenshot
    await extPage.screenshot({ path: path.join(screenshotDir, "leap-initial.png") });

    // Import wallet
    console.log("Clicking 'Import an existing wallet'");
    await extPage.getByText("Import an existing wallet").click();
    await wait(1000);

    // Click "Use recovery phrase"
    const recoveryPhraseButton = extPage.getByText(/recovery phrase|secret phrase/i);
    if (await recoveryPhraseButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("Clicking recovery phrase option");
      await recoveryPhraseButton.click();
      await wait(500);
    }

    // Fill in the mnemonic
    console.log("Entering mnemonic");
    const mnemonicWords = mnemonic.trim().split(" ");

    for (let i = 0; i < mnemonicWords.length; i++) {
      const word = mnemonicWords[i];
      const focusedInput = extPage.locator("*:focus");
      if (await focusedInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await focusedInput.fill(word);
        await extPage.keyboard.press("Tab");
      }
    }

    await wait(500);

    // Click Import button
    const importButton = extPage.getByRole("button", { name: /import|continue|next/i });
    console.log("Clicking import button");
    await importButton.click();
    await wait(1000);

    // Select wallet-1 AND wallet-2 (we need both for switching test)
    console.log("Selecting wallet-1");
    await extPage.getByTestId("wallet-1").click();
    await wait(300);

    console.log("Selecting wallet-2");
    await extPage.getByTestId("wallet-2").click();
    await wait(300);

    // Click proceed
    await extPage.getByTestId("btn-select-wallet-proceed").click();
    await wait(1000);

    // Set password
    console.log("Setting password");
    await extPage.getByTestId("input-password").fill("12345678");
    await extPage.getByTestId("input-confirm-password").fill("12345678");
    await extPage.getByTestId("btn-password-proceed").click();

    // Wait for wallet creation
    console.log("Waiting for wallet creation to complete...");
    await wait(5000);

    // Check if we're on the success screen
    const getStartedButton = extPage.getByRole("button", { name: /get started/i });
    if (await getStartedButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("Found 'Get started' button - wallet setup complete");
      await extPage.close();
      await wait(2000);

      // Reopen the extension
      const newExtPage = await context.newPage();
      await newExtPage.goto(extUrl, { waitUntil: "domcontentloaded" });
      await wait(2000);
      await newExtPage.screenshot({ path: path.join(screenshotDir, "leap-after-setup.png") });
      await newExtPage.close();
    }

    console.log("Wallet import complete");

    // Now try to connect to Akash console
    selectors.setTestIdAttribute("data-testid");
    await page.bringToFront();
    await page.reload({ waitUntil: "domcontentloaded" });
    await wait(2000);

    console.log("Attempting to connect wallet to console");
    console.log("This should open the Leap popup and show the error...");

    await page.screenshot({ path: path.join(screenshotDir, "console-before-connect.png") });

    // Connect the first wallet
    await connectWalletViaLeap(context, page);

    console.log("Connection completed");
    await page.screenshot({ path: path.join(screenshotDir, "console-after-connect.png") });

    // Get the initial wallet info
    const walletInfo1 = await page.getByLabel("Connected wallet name and balance");
    await walletInfo1.waitFor({ state: "visible", timeout: 10000 });
    const wallet1Text = await walletInfo1.textContent();
    console.log(`Initial wallet connected: ${wallet1Text}`);

    // Now switch to a different wallet in Leap extension
    console.log("Opening Leap extension to switch wallets");
    const extPage2 = await context.newPage();
    await extPage2.goto(extUrl, { waitUntil: "domcontentloaded" });
    await wait(2000);

    selectors.setTestIdAttribute("data-testing-id");

    // Find the current wallet displayed
    const currentWalletSelector = extPage2.getByText(/^Wallet \d+$/).first();
    await currentWalletSelector.waitFor({ state: "visible", timeout: 5000 });
    const currentWalletName = await currentWalletSelector.textContent();
    console.log(`Current wallet in extension: ${currentWalletName}`);

    await extPage2.screenshot({ path: path.join(screenshotDir, "leap-before-switch.png") });

    // Click wallet dropdown
    console.log("Clicking wallet dropdown");
    await currentWalletSelector.click();
    await wait(1000);

    // Check if a popup opened
    const pages = context.pages();
    console.log(`Number of pages after clicking dropdown: ${pages.length}`);

    let targetPage = extPage2;
    if (pages.length > pages.length - 1) {
      const newPopup = pages[pages.length - 1];
      console.log(`New popup detected: ${newPopup.url()}`);
      targetPage = newPopup;
      await wait(500);
    }

    await targetPage.screenshot({ path: path.join(screenshotDir, "leap-dropdown.png") });

    // Find all wallet options
    const allWalletOptions = targetPage.getByText(/^Wallet \d+$/);
    await allWalletOptions.first().waitFor({ state: "visible", timeout: 5000 });

    const walletCount = await allWalletOptions.count();
    console.log(`Found ${walletCount} wallet options`);

    // Find a different wallet
    let differentWallet = null;
    for (let i = 0; i < walletCount; i++) {
      const walletName = await allWalletOptions.nth(i).textContent();
      console.log(`  Option ${i}: ${walletName}`);
      if (walletName !== currentWalletName) {
        differentWallet = allWalletOptions.nth(i);
        console.log(`Selecting different wallet: ${walletName}`);
        break;
      }
    }

    if (!differentWallet) {
      throw new Error(`Could not find a different wallet to switch to. Current: ${currentWalletName}`);
    }

    await differentWallet.click();
    await wait(1000);

    const newWalletName = await extPage2
      .getByText(/^Wallet \d+$/)
      .first()
      .textContent();
    console.log(`Switched from '${currentWalletName}' to '${newWalletName}'`);

    await extPage2.screenshot({ path: path.join(screenshotDir, "leap-after-switch.png") });
    await extPage2.close();

    // Now reconnect to console with the new wallet
    selectors.setTestIdAttribute("data-testid");
    await page.bringToFront();
    console.log("Reloading console page");
    await page.reload({ waitUntil: "domcontentloaded" });
    await wait(2000);

    // Check if we need to reconnect
    const needsReconnect = await page
      .getByText("Connect")
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (needsReconnect) {
      console.log("Reconnecting with new wallet");
      await page.screenshot({ path: path.join(screenshotDir, "console-before-reconnect.png") });

      // Add extra logging to debug the reconnection
      console.log("Number of pages before reconnect:", context.pages().length);
      await connectWalletViaLeap(context, page);
      console.log("Number of pages after reconnect:", context.pages().length);
    } else {
      console.log("Still connected, no need to reconnect");
    }

    // Get the new wallet info
    const walletInfo2 = await page.getByLabel("Connected wallet name and balance");
    await walletInfo2.waitFor({ state: "visible", timeout: 10000 });
    const wallet2Text = await walletInfo2.textContent();
    console.log(`Wallet after switch: ${wallet2Text}`);

    await page.screenshot({ path: path.join(screenshotDir, "console-after-switch.png") });

    // Verify the wallet changed
    if (wallet1Text === wallet2Text) {
      throw new Error(`Wallet did not change in console! Still showing: ${wallet2Text}`);
    }

    console.log("✅ SUCCESS: Wallet switching test passed!");
    console.log(`  Initial wallet (${currentWalletName}): ${wallet1Text}`);
    console.log(`  After switch (${newWalletName}): ${wallet2Text}`);
  } catch (error) {
    console.error("Test failed with error:", error);
    await page.screenshot({ path: path.join(screenshotDir, "error-console.png") });
    throw error;
  } finally {
    selectors.setTestIdAttribute("data-testid");
  }

  console.log("Test completed");
});
