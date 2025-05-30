import type { Page } from "@playwright/test";
import { setTimeout as wait } from "timers/promises";

import { approveWalletOperation } from "../fixture/wallet-setup";

export async function selectChainNetwork(page: Page, networkId = "sandbox") {
  await page.getByRole("link", { name: "App Settings" }).click();
  await page.getByLabel("Select Network").click();
  await page.getByLabel(new RegExp(networkId, "i")).click();

  const [popupPage] = await Promise.all([
    // sometimes Leap requires to approve the operation again
    page
      .context()
      .waitForEvent("page", { timeout: 3_000 })
      .catch(() => null),
    wait(100).then(() => page.getByRole("button", { name: "Save" }).click())
  ]);
  await approveWalletOperation(popupPage);
}
