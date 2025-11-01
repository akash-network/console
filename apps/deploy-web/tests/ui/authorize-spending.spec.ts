import { shortenAddress } from "@akashnetwork/ui/components";
import type { BrowserContext, Page } from "@playwright/test";

import { expect, test } from "./fixture/context-with-extension";
import { clickCopyAddressButton } from "./fixture/testing-helpers";
import { getExtensionPage } from "./fixture/wallet-setup";
import type { AuthorizationListLabel, AuthorizeButtonLabel } from "./pages/AuthorizationsPage";
import { AuthorizationsPage } from "./pages/AuthorizationsPage";
import { LeapExt } from "./pages/LeapExt";

type TestProps = {
  name: string;
  buttonLabel: AuthorizeButtonLabel;
  listLabel: AuthorizationListLabel;
};

const runAuthorizationTest = ({ name, buttonLabel, listLabel }: TestProps) => {
  test.describe(`${name} Authorizations`, () => {
    test("can authorize spending", async ({ page, context, extensionId }) => {
      test.setTimeout(5 * 60 * 1000);

      const { authorizationsPage, address } = await setup({ page, context, extensionId, buttonLabel });

      const shortenedAddress = shortenAddress(address);
      const grantList = authorizationsPage.page.getByLabel(listLabel);
      await expect(grantList.locator("tr", { hasText: shortenedAddress })).toBeVisible();
    });

    test("can edit spending", async ({ page, context, extensionId }) => {
      test.setTimeout(5 * 60 * 1000);

      const { authorizationsPage, address, extension } = await setup({ page, context, extensionId, buttonLabel });
      await authorizationsPage.editSpending(address, listLabel);
      await extension.acceptTransaction(context);

      const grantList = authorizationsPage.page.getByLabel(listLabel);
      await expect(grantList.locator("tr", { hasText: "10.000000 AKT" })).toBeVisible();
    });

    test("can revoke spending", async ({ page, context, extensionId }) => {
      test.setTimeout(5 * 60 * 1000);

      const { authorizationsPage, address, extension } = await setup({ page, context, extensionId, buttonLabel });
      await authorizationsPage.revokeSpending(address, listLabel);
      await extension.acceptTransaction(context);

      const shortenedAddress = shortenAddress(address);
      const grantList = authorizationsPage.page.getByLabel(listLabel);
      await expect(grantList.locator("tr", { hasText: shortenedAddress })).not.toBeVisible();
    });
  });
};

runAuthorizationTest({ name: "Deployment", buttonLabel: "Authorize Spend", listLabel: "Deployment Authorization List" });
runAuthorizationTest({ name: "Tx Fee", buttonLabel: "Authorize Fee Spend", listLabel: "Tx Fee Authorization List" });

type SetupProps = {
  page: Page;
  context: BrowserContext;
  extensionId: string;
  buttonLabel: AuthorizeButtonLabel;
};

const setup = async ({ page, context, extensionId, buttonLabel }: SetupProps) => {
  const extension = new LeapExt(context, page);
  const address = await clickCopyAddressButton(await getExtensionPage(context, extensionId));
  await extension.createWallet(extensionId);

  const authorizationsPage = new AuthorizationsPage(context, page);
  await authorizationsPage.goto();

  await authorizationsPage.authorizeSpending(address, buttonLabel);
  await extension.acceptTransaction(context);

  return {
    authorizationsPage,
    address,
    extension
  };
};
