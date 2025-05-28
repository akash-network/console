import type { BrowserContext, Page } from "@playwright/test";
import { chromium } from "@playwright/test";
import fs from "fs";
import { nanoid } from "nanoid";
import path from "path";

import { injectUIConfig, test as baseTest } from "./base-test";

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
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent("serviceworker");
    }

    const extensionId = background.url().split("/")[2];
    await use(extensionId);
  },
  page: async ({ context, extensionId }, use) => {
    try {
      await context.waitForEvent("page", { timeout: 5000 });
    } catch {
      // ignore timeout error
    }

    const extUrl = `chrome-extension://${extensionId}/index.html`;
    let extPage = context.pages().find(page => page.url().startsWith(extUrl));

    if (!extPage) {
      extPage = await context.newPage();
      await extPage.goto(extUrl);
      await extPage.waitForLoadState("domcontentloaded");
    }

    await injectUIConfig(extPage);
    await use(extPage);
  }
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
