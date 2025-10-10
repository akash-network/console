import type { BrowserContext } from "@playwright/test";
import { chromium, selectors } from "@playwright/test";
import { nanoid } from "nanoid";
import path from "path";
import { setTimeout as wait } from "timers/promises";

import { injectUIConfig, test as baseTest } from "./fixture/base-test";
import { testEnvConfig } from "./fixture/test-env.config";

import { connectWalletViaLeap } from "@tests/ui/fixture/wallet-setup";

// Use a simpler fixture that doesn't do the full wallet connection flow
const test = baseTest.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const pathToExtension = path.join(__dirname, "fixture", "Leap");
    const contextName = nanoid();
    const userDataDir = path.join(__dirname, "fixture", "testdata", "tmp", contextName);
    const args = [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`
    ];

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

test("wallet change in Leap reflects in console", async ({ context, page: _page, extensionId }) => {
  test.setTimeout(10 * 60 * 1000);

  console.log("Starting wallet change test");

  // Define screenshot directory
  const screenshotDir = path.join(__dirname, "test-results", "wallet-change-screenshots");
  console.log(`Screenshots will be saved to: ${screenshotDir}`);

  // Get test mnemonic
  const mnemonic = process.env.TEST_WALLET_MNEMONIC;
  if (!mnemonic) {
    throw new Error("TEST_WALLET_MNEMONIC environment variable is not set");
  }

  // Open the Leap extension in a new page
  const extUrl = `chrome-extension://${extensionId}/index.html`;
  const extPage = await context.newPage();

  try {
    // Switch to use test-id attribute for Leap extension
    selectors.setTestIdAttribute("data-testing-id");

    await extPage.goto(extUrl, { waitUntil: "domcontentloaded" });
    console.log("Leap extension page opened");

    // Wait for extension to load
    await wait(2000);

    // Take initial screenshot
    const initialScreenshot = path.join(screenshotDir, "leap-initial.png");
    await extPage.screenshot({ path: initialScreenshot });
    console.log(`Initial screenshot saved: ${initialScreenshot}`);

    // Import wallet - click "Import an existing wallet"
    console.log("Clicking 'Import an existing wallet'");
    await extPage.getByText("Import an existing wallet").click();
    await wait(1000);

    // Take screenshot of import screen
    await extPage.screenshot({ path: path.join(screenshotDir, "leap-import-screen.png") });

    // Click "Use recovery phrase" or similar
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
      // Try to find input focused or by index
      const focusedInput = extPage.locator("*:focus");
      if (await focusedInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await focusedInput.fill(word);
        await extPage.keyboard.press("Tab");
      }
    }

    await wait(500);
    await extPage.screenshot({ path: path.join(screenshotDir, "leap-after-mnemonic.png") });

    // Click Import/Continue button
    const importButton = extPage.getByRole("button", { name: /import|continue|next/i });
    console.log("Clicking import button");
    await importButton.click();
    await wait(1000);

    // Take screenshot after import
    await extPage.screenshot({ path: path.join(screenshotDir, "leap-wallet-selection.png") });

    // Select wallet-1 AND wallet-2
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

    // Wait for "Creating your wallet" loading screen to disappear
    console.log("Waiting for wallet creation to complete...");
    const creatingWalletText = extPage.getByText("Creating your wallet");

    // Wait for the loading screen to appear first
    if (await creatingWalletText.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log("Wallet creation in progress");
      // Then wait for it to disappear (wallet creation complete)
      await creatingWalletText.waitFor({ state: "hidden", timeout: 30000 });
      console.log("Wallet creation completed");
    }

    await wait(1000);

    // Take screenshot after wallet creation
    await extPage.screenshot({ path: path.join(screenshotDir, "leap-after-creation.png") });

    // Check if we're on the success screen
    const getStartedButton = extPage.getByRole("button", { name: /get started/i });
    if (await getStartedButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("Found 'Get started' button - wallet setup complete");
      // Don't click it - it will navigate away from the extension
      // Instead, close this page and open the extension fresh
      await extPage.close();
      console.log("sleeping 2s before reopening extension");
      await wait(2000);
      console.log("Closed setup page, reopening extension");

      // Reopen the extension to the main wallet UI
      const newExtPage = await context.newPage();
      await newExtPage.goto(extUrl, { waitUntil: "domcontentloaded" });
      await wait(2000);

      // Take screenshot after reopening
      await newExtPage.screenshot({ path: path.join(screenshotDir, "leap-after-setup.png") });

      // Use the new page going forward
      Object.assign(extPage, newExtPage);
    } else {
      // Take screenshot if we didn't find the success screen
      await extPage.screenshot({ path: path.join(screenshotDir, "leap-after-setup.png") });
    }

    // Now look for wallet dropdown - find any wallet name that starts with "Wallet "
    const walletSelector = extPage.getByText(/^Wallet \d+$/);

    const isWalletVisible = await walletSelector
      .first()
      .isVisible({ timeout: 30000 })
      .catch(() => false);

    if (!isWalletVisible) {
      console.log("Wallet selector not found after setup");
      await extPage.screenshot({ path: path.join(screenshotDir, "leap-wallet-not-found.png") });
      const allText = await extPage.locator("body").textContent();
      console.log(`Page text: ${allText?.substring(0, 500)}`);
      throw new Error("Could not find wallet selector after setup");
    }

    // Get the currently selected wallet name
    const currentWallet = await walletSelector.first().textContent();
    console.log(`Current wallet: ${currentWallet}`);

    // Click wallet dropdown
    console.log("Clicking wallet dropdown");
    await walletSelector.first().click();
    await wait(1000);

    // Take screenshot of dropdown
    await extPage.screenshot({ path: path.join(screenshotDir, "leap-dropdown.png") });
    console.log("Dropdown screenshot saved");

    // Check if dropdown opened or if a new popup appeared
    const pages = context.pages();
    console.log(`Number of pages after clicking dropdown: ${pages.length}`);

    // Look for wallet options in the current page or any new popup
    let targetPage = extPage;
    if (pages.length > 2) {
      // A new popup might have appeared
      const newPopup = pages[pages.length - 1];
      console.log(`New popup detected: ${newPopup.url()}`);
      targetPage = newPopup;
      await wait(500);
      await targetPage.screenshot({ path: path.join(screenshotDir, "leap-popup.png") });
    }

    // Find all wallet options and select a different one
    console.log("Finding available wallet options");
    const allWalletOptions = targetPage.getByText(/^Wallet \d+$/);
    await allWalletOptions.first().waitFor({ state: "visible", timeout: 5000 });

    // Get all wallet names
    const walletCount = await allWalletOptions.count();
    console.log(`Found ${walletCount} wallet options in dropdown`);

    // Debug: print all available wallets
    for (let i = 0; i < walletCount; i++) {
      const walletName = await allWalletOptions.nth(i).textContent();
      console.log(`  Option ${i}: ${walletName}`);
    }

    // Find a wallet that's different from the current one
    let differentWallet = null;
    for (let i = 0; i < walletCount; i++) {
      const walletName = await allWalletOptions.nth(i).textContent();
      if (walletName !== currentWallet) {
        differentWallet = allWalletOptions.nth(i);
        console.log(`Selecting different wallet: ${walletName}`);
        break;
      }
    }

    if (!differentWallet) {
      // If we can't find a different wallet, maybe the dropdown isn't fully loaded
      // Let's wait a bit and try taking a screenshot
      await wait(1000);
      await targetPage.screenshot({ path: path.join(screenshotDir, "leap-dropdown-no-options.png") });
      const pageText = await targetPage.locator("body").textContent();
      console.log(`Page text: ${pageText?.substring(0, 500)}`);
      throw new Error(`Could not find a different wallet to switch to. Current wallet: ${currentWallet}, found ${walletCount} options`);
    }

    await differentWallet.click();
    await wait(1000);

    // Take screenshot after switching
    await extPage.screenshot({ path: path.join(screenshotDir, "leap-after-switch.png") });
    console.log("Successfully switched wallets");

    // Now verify the wallet change is reflected in the console
    selectors.setTestIdAttribute("data-testid");

    // Get the console page
    const consolePage = context.pages().find(p => p.url().includes(testEnvConfig.BASE_URL));
    if (!consolePage) {
      throw new Error("Console page not found");
    }

    console.log("Navigating to console to connect wallet");
    await consolePage.bringToFront();
    await consolePage.goto(testEnvConfig.BASE_URL);
    await wait(2000);

    // Connect wallet (with Wallet 1 initially)
    console.log("Connecting wallet to console");
    await connectWalletViaLeap(context, consolePage);

    // Get the wallet address displayed in console for Wallet 1
    const walletInfo1 = await consolePage.getByLabel("Connected wallet name and balance");
    await walletInfo1.waitFor({ state: "visible", timeout: 10000 });
    const wallet1Text = await walletInfo1.textContent();
    console.log(`Wallet 1 connected in console: ${wallet1Text}`);

    // Take screenshot showing Wallet 1 in console
    await consolePage.screenshot({ path: path.join(screenshotDir, "console-wallet1.png") });

    // Now switch to a different wallet in Leap extension
    console.log("Opening Leap extension to switch to a different wallet");
    const extPage2 = await context.newPage();
    await extPage2.goto(`chrome-extension://${extensionId}/index.html`, { waitUntil: "domcontentloaded" });
    await wait(1000);

    // Set test id for extension
    selectors.setTestIdAttribute("data-test-id");

    // Click wallet dropdown in extension
    console.log("Clicking wallet dropdown to switch wallets");
    const currentWalletSelector2 = extPage2.getByText(/^Wallet \d+$/).first();
    await currentWalletSelector2.waitFor({ state: "visible", timeout: 5000 });

    // Get the current wallet name before clicking
    const currentWallet2 = await currentWalletSelector2.textContent();
    console.log(`Current wallet in extension: ${currentWallet2}`);

    await currentWalletSelector2.click();
    await wait(1000);

    // Check for popup
    const pages2 = context.pages();
    const pageCountBefore = pages2.length;
    await wait(500);
    const pages2After = context.pages();

    let targetPage2 = extPage2;
    if (pages2After.length > pageCountBefore) {
      const newPopup = pages2After[pages2After.length - 1];
      console.log(`New popup detected: ${newPopup.url()}`);
      targetPage2 = newPopup;
      await wait(500);
    }

    // Select a different wallet from the dropdown
    console.log("Finding available wallet options");
    const allWalletOptions2 = targetPage2.getByText(/^Wallet \d+$/);
    await allWalletOptions2.first().waitFor({ state: "visible", timeout: 5000 });

    const walletCount2 = await allWalletOptions2.count();
    console.log(`Found ${walletCount2} wallet options`);

    // Find a different wallet
    let differentWallet2 = null;
    for (let i = 0; i < walletCount2; i++) {
      const walletName = await allWalletOptions2.nth(i).textContent();
      if (walletName !== currentWallet2) {
        differentWallet2 = allWalletOptions2.nth(i);
        console.log(`Switching to: ${walletName}`);
        break;
      }
    }

    if (!differentWallet2) {
      throw new Error("Could not find a different wallet to switch to");
    }

    await differentWallet2.click();
    await wait(1000);

    console.log("Switched to Wallet 2 in extension");
    await extPage2.screenshot({ path: path.join(screenshotDir, "leap-wallet2-selected.png") });
    await extPage2.close();

    // Go back to console and verify wallet changed
    selectors.setTestIdAttribute("data-testid");
    await consolePage.bringToFront();

    // Reload the page to trigger wallet reconnection with new wallet
    console.log("Reloading console to pick up wallet change");
    await consolePage.reload({ waitUntil: "domcontentloaded" });
    await wait(2000);

    // The wallet should auto-reconnect with Wallet 2
    const walletInfo2 = await consolePage.getByLabel("Connected wallet name and balance");
    await walletInfo2.waitFor({ state: "visible", timeout: 10000 });
    const wallet2Text = await walletInfo2.textContent();
    console.log(`Wallet after switch in console: ${wallet2Text}`);

    // Take screenshot showing Wallet 2 in console
    await consolePage.screenshot({ path: path.join(screenshotDir, "console-wallet2.png") });

    // Verify the wallet changed
    if (wallet1Text === wallet2Text) {
      throw new Error(`Wallet did not change in console! Still showing: ${wallet2Text}`);
    }

    console.log("✅ SUCCESS: Wallet change in Leap is reflected in console");
    console.log(`  Wallet 1: ${wallet1Text}`);
    console.log(`  Wallet 2: ${wallet2Text}`);
  } finally {
    // Reset test id attribute back to default for console
    selectors.setTestIdAttribute("data-testid");
    await extPage.close();
  }
});
