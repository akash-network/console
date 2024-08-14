import { expect, selectors } from "@playwright/test";
import { test } from "./utils/fixture";

import { SSH_VM_IMAGES } from "@src/utils/sdl/data";
import { DeployHelloWorldPage } from "./pages/DeployHelloWorldPage";

test.beforeAll(async ({ page, extensionId }) => {
  page.waitForLoadState("domcontentloaded");
  console.log("clicking seed");
  selectors.setTestIdAttribute("data-testing-id");

  await page.goto(`chrome-extension://${extensionId}/index.html#/onboarding`);
  await page.getByTestId("import-seed-phrase").click();

  await page.locator(`//*[@id="root"]/div/div[2]/div/div[1]/div[1]/div/div[2]/div[1]`).click();
  await page.locator("input").fill("test");

  await page.pause();

  selectors.setTestIdAttribute("data-testid");
});

test.only("deploy hello world", async ({ page }) => {
  console.log("testing");
  const customTemplatePage = new DeployHelloWorldPage(page, "new-deployment", "build-template-card");
  await customTemplatePage.gotoInteractive();
});
