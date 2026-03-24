import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import type { BrowserContext, Page } from "@playwright/test";

import { createPage, expect, test } from "./fixture/context-with-extension";
import { topUpWallet } from "./fixture/wallet-setup";
import type { AuthorizationType } from "./pages/AuthorizationsPage";
import { AuthorizationsPage, shortenAddress } from "./pages/AuthorizationsPage";
import { WebWallet } from "./pages/WebWallet";

test.describe("Deployment Authorizations", () => {
  includeAuthorizationTests({ authType: "deployment", denom: "ACT" });
});

test.describe("Tx Fee Authorizations", () => {
  includeAuthorizationTests({ authType: "tx_fee", denom: "AKT" });
});

function includeAuthorizationTests(input: { authType: AuthorizationType; denom: "ACT" | "AKT" }) {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const page = await createPage(context);
      const authorizationsPage = new AuthorizationsPage(context, page);
      await authorizationsPage.goto();
      await authorizationsPage.revokeAll(input.authType);
    } finally {
      await context.close();
    }
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const page = await createPage(context);
      const authorizationsPage = new AuthorizationsPage(context, page);
      await authorizationsPage.goto();
      await authorizationsPage.revokeAll(input.authType);
    } finally {
      await context.close();
    }
  });

  test("can authorize spending", async ({ page, context }) => {
    const { authorizationsPage, anotherWalletAddress: address } = await setup({ page, context, ...input });

    const shortenedAddress = shortenAddress(address);
    const grantList = authorizationsPage.getListLocator(input.authType);

    await expect(grantList.locator("td", { hasText: shortenedAddress })).toBeVisible({ timeout: 10_000 });
  });

  test("can edit spending", async ({ page, context }) => {
    const { authorizationsPage, anotherWalletAddress: address, extension } = await setup({ page, context, ...input });
    await Promise.all([extension.acceptTransaction("high"), authorizationsPage.editSpending(input.authType, address)]);
    await extension.waitForTransaction("success");

    const grantList = authorizationsPage.getListLocator(input.authType);
    await expect(grantList.locator("tr", { hasText: new RegExp(`10(\\.0+?)\\s*${input.denom}`) })).toBeVisible({ timeout: 10_000 });
  });

  test("can revoke spending", async ({ page, context }) => {
    const { authorizationsPage, anotherWalletAddress: address, extension } = await setup({ page, context, ...input });

    await Promise.all([extension.acceptTransaction("high"), authorizationsPage.revokeSpending(input.authType, address)]);
    await extension.waitForTransaction("success");

    const shortenedAddress = shortenAddress(address);
    const grantList = authorizationsPage.getListLocator(input.authType);
    await expect(grantList.locator("tr", { hasText: shortenedAddress })).not.toBeVisible({ timeout: 10_000 });
  });
}

async function setup({ page, context, authType }: { page: Page; context: BrowserContext; authType: AuthorizationType }) {
  const extension = new WebWallet(context, page);
  const anotherWallet = await DirectSecp256k1HdWallet.generate(12, { prefix: "akash" });
  const anotherWalletAccounts = await anotherWallet.getAccounts();
  const anotherWalletAddress = anotherWalletAccounts[0].address;

  await topUpWallet(anotherWalletAddress);

  const authorizationsPage = new AuthorizationsPage(context, page);
  await authorizationsPage.goto();

  await Promise.all([extension.acceptTransaction("high"), authorizationsPage.authorizeSpending(authType, anotherWalletAccounts[0].address)]);
  const notification = await extension.getTransaction("success");
  await notification.close();

  return {
    authorizationsPage,
    anotherWalletAddress,
    extension
  };
}
