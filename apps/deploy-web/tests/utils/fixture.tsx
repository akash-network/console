import { test as base, BrowserContext, chromium, selectors } from "@playwright/test";
import path from "path";

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    console.log("context");
    const pathToExtension = path.join(__dirname, "Leap");
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [`--disable-extensions-except=${pathToExtension}`, `--load-extension=${pathToExtension}`]
    });
    console.log("using context");
    await use(context);

    await context.close();
  },
  extensionId: async ({ context }, use) => {
    console.log("extensionId");
    /*
    // for manifest v2:
    let [background] = context.backgroundPages()
    if (!background)
      background = await context.waitForEvent('backgroundpage')
    */

    // for manifest v3:
    let [background] = context.serviceWorkers();
    if (!background) background = await context.waitForEvent("serviceworker");

    const extensionId = background.url().split("/")[2];
    await use(extensionId);

    context.route;
  }
});
export const expect = test.expect;
