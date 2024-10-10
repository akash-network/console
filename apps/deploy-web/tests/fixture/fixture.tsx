import { BrowserContext, chromium, Page, test as base } from "@playwright/test";
import { nanoid } from "nanoid";
import path from "path";

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
  extPage: Page;
}>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    console.log("context");
    const pathToExtension = path.join(__dirname, "Leap");
    const contextName = nanoid();
    const userDataDir = path.join(__dirname, "./testdata/tmp/" + contextName);
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [`--disable-extensions-except=${pathToExtension}`, `--load-extension=${pathToExtension}`]
    });
    console.log("using context");
    await use(context);

    // await context.close();
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
  },
  extPage: [
    async ({ context }, use) => {
      const pageList = context.pages();
      if (pageList && pageList.length > 1) {
        const extensionPage = pageList.filter(page => page.url().includes("extension")) || [];
        if (extensionPage[0]) {
          await extensionPage[0].waitForLoadState();
          await use(extensionPage[0]);
        }
      } else {
        const page = await context.waitForEvent("page");
        await page.waitForLoadState();
        if (page.url().includes("extension")) {
          await use(page);
        }
      }
    },
    { scope: "test" }
  ]
});
export const expect = test.expect;
