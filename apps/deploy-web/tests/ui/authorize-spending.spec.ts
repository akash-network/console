import { shortenAddress } from "@akashnetwork/ui/components";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import type { BrowserContext, Page } from "@playwright/test";

import { expect, test } from "./fixture/context-with-extension";
import { topUpWallet } from "./fixture/wallet-setup";
import type { AuthorizationType } from "./pages/AuthorizationsPage";
import { AuthorizationsPage } from "./pages/AuthorizationsPage";
import { LeapExt } from "./pages/LeapExt";

test.describe("Deployment Authorizations", () => {
  includeAuthorizationTests({ authType: "deployment" });
});

test.describe("Tx Fee Authorizations", () => {
  includeAuthorizationTests({ authType: "tx_fee" });
});

function includeAuthorizationTests(input: { authType: AuthorizationType }) {
  test.beforeAll(async ({ page, context }) => {
    const authorizationsPage = new AuthorizationsPage(context, page);
    await authorizationsPage.goto();
    await authorizationsPage.revokeAll(input.authType);
  });

  test.afterAll(async ({ page, context }) => {
    const authorizationsPage = new AuthorizationsPage(context, page);
    await authorizationsPage.goto();
    await authorizationsPage.revokeAll(input.authType);
  });

  test("can authorize spending", async ({ page, context, extensionId }) => {
    const { authorizationsPage, anotherWalletAddress: address } = await setup({ page, context, extensionId, ...input });

    const shortenedAddress = shortenAddress(address);
    const grantList = authorizationsPage.getListLocator(input.authType);

    await expect(grantList.locator("td", { hasText: shortenedAddress })).toBeVisible({ timeout: 10_000 });
  });

  test("can edit spending", async ({ page, context, extensionId }) => {
    const { authorizationsPage, anotherWalletAddress: address, extension } = await setup({ page, context, extensionId, ...input });
    await Promise.all([extension.waitForTransaction("success"), extension.acceptTransaction(), authorizationsPage.editSpending(input.authType, address)]);

    const grantList = authorizationsPage.getListLocator(input.authType);
    await expect(grantList.locator("tr", { hasText: /10(\.0+?) AKT/ })).toBeVisible({ timeout: 10_000 });
  });

  test("can revoke spending", async ({ page, context, extensionId }) => {
    const { authorizationsPage, anotherWalletAddress: address, extension } = await setup({ page, context, extensionId, ...input });

    await Promise.all([extension.waitForTransaction("success"), extension.acceptTransaction(), authorizationsPage.revokeSpending(input.authType, address)]);

    const shortenedAddress = shortenAddress(address);
    const grantList = authorizationsPage.getListLocator(input.authType);
    await expect(grantList.locator("tr", { hasText: shortenedAddress })).not.toBeVisible({ timeout: 10_000 });
  });
}

async function setup({ page, context, authType }: { page: Page; context: BrowserContext; extensionId: string; authType: AuthorizationType }) {
  const extension = new LeapExt(context, page);
  const anotherWallet = await DirectSecp256k1HdWallet.generate(12, { prefix: "akash" });
  const [anotherWalletAccounts] = await Promise.all([await anotherWallet.getAccounts(), topUpWallet(anotherWallet)]);

  const authorizationsPage = new AuthorizationsPage(context, page);
  await authorizationsPage.goto();

  await Promise.all([
    extension.waitForTransaction("success"),
    extension.acceptTransaction(),
    authorizationsPage.authorizeSpending(authType, anotherWalletAccounts[0].address)
  ]);

  return {
    authorizationsPage,
    anotherWalletAddress: anotherWalletAccounts[0].address,
    extension
  };
}
