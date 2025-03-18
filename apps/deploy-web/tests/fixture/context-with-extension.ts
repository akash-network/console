import { BrowserContext, chromium, Page, test as baseTest } from "@playwright/test";
import fs from "fs";
import { nanoid } from "nanoid";
import path from "path";
import { setTimeout as delay } from "timers/promises";

// @see https://github.com/microsoft/playwright/issues/14949
export async function restoreExtensionStorage(page: Page): Promise<void> {
  const extensionStorage = JSON.parse(fs.readFileSync(path.join(__dirname, "leapExtensionLocalStorage.json"), "utf8"));
  await page.evaluate(data => chrome.storage.local.set(data), extensionStorage);
}

// @see https://playwright.dev/docs/chrome-extensions
export const test = baseTest.extend<{
  context: BrowserContext;
  extensionId: string;
  extPage: Page;
}>({
  context: async ({ headless }, use) => {
    const pathToExtension = path.join(__dirname, "Leap");
    const contextName = nanoid();
    const userDataDir = path.join(__dirname, "./testdata/tmp/" + contextName);
    const args = [
      // keep new line
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`
    ];
    if (headless) {
      args.unshift("--headless=new");
    }
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless,
      args
    });
    await use(context);

    // await context.close();
  },
  extensionId: async ({ context }, use) => {
    const extensions = context.backgroundPages();

    let background = context.serviceWorkers()[0];
    if (!background) {
      for (let i = 0; i < 5; i++) {
        background = context.serviceWorkers()[0];
        if (background) break;
        await delay(Math.pow(2, i) * 1000); // exponential backoff
      }
    }

    if (!background) {
      throw new Error("Could not find extension service worker or background page after multiple attempts. Extensions loaded: " + extensions.length);
    }

    const extensionId = background.url().split("/")[2];
    await use(extensionId);
  },
  extPage: [
    async ({ context, extensionId }, use) => {
      const extPage = await context.newPage();
      await extPage.goto(`chrome-extension://${extensionId}/index.html`);
      await extPage.waitForLoadState("domcontentloaded");
      await use(extPage);
    },
    { scope: "test" }
  ]
});

export const expect = test.expect;

export interface ExtensionContext {
  context: BrowserContext;
  page: Page;
  extensionId: string;
}

declare global {
  const chrome: any;
}
