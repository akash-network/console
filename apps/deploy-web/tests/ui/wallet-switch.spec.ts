import { selectors } from "@playwright/test";
import path from "path";
import { setTimeout as wait } from "timers/promises";

import { test } from "./fixture/context-with-extension";
import { approveWalletOperation, connectWalletViaLeap } from "./fixture/wallet-setup";

test("wallet switch - should update console UI when wallet changes in Leap extension", async ({ context, page, extensionId }) => {
  test.setTimeout(10 * 60 * 1000);

  console.log("Starting wallet switch test");

  const screenshotDir = path.join(__dirname, "test-results", "wallet-switch-screenshots");

  try {
    // Connect the initial wallet
    console.log("Connecting initial wallet");
    await connectWalletViaLeap(context, page);
    await page.screenshot({ path: path.join(screenshotDir, "01-console-after-connect.png") });

    // Get the initial wallet info
    const walletInfo1 = await page.getByLabel("Connected wallet name and balance");
    await walletInfo1.waitFor({ state: "visible", timeout: 10000 });
    const wallet1Text = await walletInfo1.textContent();
    console.log(`Initial wallet connected: ${wallet1Text}`);

    // Open Leap extension to switch wallets
    console.log("Opening Leap extension to switch wallets");
    const extUrl = `chrome-extension://${extensionId}/index.html`;
    const extPage = await context.newPage();
    await extPage.goto(extUrl, { waitUntil: "domcontentloaded" });
    await wait(2000);

    selectors.setTestIdAttribute("data-testing-id");

    // Find the current wallet displayed
    const currentWalletSelector = extPage.getByText(/^Wallet \d+$/).first();
    await currentWalletSelector.waitFor({ state: "visible", timeout: 5000 });
    const currentWalletName = await currentWalletSelector.textContent();
    console.log(`Current wallet in extension: ${currentWalletName}`);

    await extPage.screenshot({ path: path.join(screenshotDir, "02-leap-before-switch.png") });

    // Click wallet dropdown
    console.log("Clicking wallet dropdown");
    await currentWalletSelector.click();
    await wait(1000);

    // Check if a popup opened
    const pages = context.pages();
    console.log(`Number of pages after clicking dropdown: ${pages.length}`);

    let targetPage = extPage;
    if (pages.length > pages.length - 1) {
      const newPopup = pages[pages.length - 1];
      console.log(`New popup detected: ${newPopup.url()}`);
      targetPage = newPopup;
      await wait(500);
    }

    await targetPage.screenshot({ path: path.join(screenshotDir, "03-leap-dropdown.png") });

    // Find all wallet options
    const allWalletOptions = targetPage.getByText(/^Wallet \d+$/);
    await allWalletOptions.first().waitFor({ state: "visible", timeout: 5000 });

    const walletCount = await allWalletOptions.count();
    console.log(`Found ${walletCount} wallet options`);

    // Find a different wallet
    let differentWallet = null;
    let newWalletName = null;
    for (let i = 0; i < walletCount; i++) {
      const walletName = await allWalletOptions.nth(i).textContent();
      console.log(`  Option ${i}: ${walletName}`);
      if (walletName !== currentWalletName) {
        differentWallet = allWalletOptions.nth(i);
        newWalletName = walletName;
        console.log(`Selecting different wallet: ${walletName}`);
        break;
      }
    }

    if (!differentWallet) {
      throw new Error(`Could not find a different wallet to switch to. Current: ${currentWalletName}`);
    }

    await differentWallet.click();
    await wait(1000);

    const confirmedWalletName = await extPage
      .getByText(/^Wallet \d+$/)
      .first()
      .textContent();
    console.log(`Switched from '${currentWalletName}' to '${confirmedWalletName}'`);

    await extPage.screenshot({ path: path.join(screenshotDir, "04-leap-after-switch.png") });
    await extPage.close();

    // Now reconnect to console with the new wallet
    console.log("Bringing console page to front");
    selectors.setTestIdAttribute("data-testid");
    await page.bringToFront();
    await wait(2000);

    // Check if we need to reconnect
    const needsReconnect = await page
      .getByText("Connect")
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (needsReconnect) {
      console.log("Reconnecting with new wallet");
      await page.screenshot({ path: path.join(screenshotDir, "05-console-before-reconnect.png") });
      await connectWalletViaLeap(context, page);
    } else {
      console.log("Still connected, no need to reconnect");
    }

    // Get the new wallet info
    const walletInfo2 = await page.getByLabel("Connected wallet name and balance");
    await walletInfo2.waitFor({ state: "visible", timeout: 10000 });
    const wallet2Text = await walletInfo2.textContent();
    console.log(`Wallet after switch: ${wallet2Text}`);
    await page.screenshot({ path: path.join(screenshotDir, "06-console-after-switch-before-reload.png") });

    // Reload the page - this should trigger a Leap popup asking to approve the new wallet
    console.log("Reloading page to trigger approval popup");
    const popupPromise = context.waitForEvent("page", { timeout: 10_000 }).catch(() => null);
    await page.reload({ waitUntil: "domcontentloaded" });

    // Wait for the Leap approval popup
    const approvalPopup = await popupPromise;
    if (approvalPopup) {
      console.log("Approval popup detected, approving connection with new wallet");
      await wait(1000);
      await approvalPopup.screenshot({ path: path.join(screenshotDir, "07-leap-approval-popup.png") });

      // Switch to Leap extension test id attribute for approval
      selectors.setTestIdAttribute("data-testing-id");
      await approveWalletOperation(approvalPopup);
      selectors.setTestIdAttribute("data-testid");

      console.log("Approved connection with new wallet");
      await wait(1000);
    } else {
      console.log("No approval popup appeared - wallet may have auto-connected");
    }

    await page.screenshot({ path: path.join(screenshotDir, "08-console-after-switch-after-reload.png") });

    // Get the final wallet info after reload and approval
    const walletInfo3 = await page.getByLabel("Connected wallet name and balance");
    await walletInfo3.waitFor({ state: "visible", timeout: 10000 });
    const wallet3Text = await walletInfo3.textContent();
    console.log(`Final wallet after reload and approval: ${wallet3Text}`);

    // Verify the wallet changed from the initial wallet
    if (wallet1Text === wallet3Text) {
      throw new Error(`Wallet did not change in console! Initial: ${wallet1Text}, Final: ${wallet3Text}`);
    }

    console.log("✅ SUCCESS: Wallet switching test passed!");
    console.log(`  Initial wallet (${currentWalletName}): ${wallet1Text}`);
    console.log(`  After switch (${newWalletName}): ${wallet2Text}`);
    console.log(`  Final after reload: ${wallet3Text}`);
  } catch (error) {
    console.error("Test failed with error:", error);
    await page.screenshot({ path: path.join(screenshotDir, "error-console.png") });
    throw error;
  } finally {
    selectors.setTestIdAttribute("data-testid");
  }

  console.log("Test completed");
});
