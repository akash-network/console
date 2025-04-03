import type { Page } from "@playwright/test";

export async function selectChainNetwork(page: Page, networkId = "sandbox") {
  await page.getByRole("link", { name: "App Settings" }).click();
  await page.getByLabel("Select Network").click();
  await page.getByLabel(new RegExp(networkId, "i")).click();
  await page.getByRole("button", { name: "Save" }).click();
}
