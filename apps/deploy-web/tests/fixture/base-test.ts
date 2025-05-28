import type { Page } from "@playwright/test";
import { test as baseTest } from "@playwright/test";

import type { BrowserEnvConfig } from "@src/config/browser-env.config";
import { testEnvConfig } from "./test-env.config";

export * from "@playwright/test";

export const test = baseTest.extend({
  page: async ({ page }, use) => {
    await injectUIConfig(page);
    await use(page);
  }
});

export async function injectUIConfig(page: Page) {
  if (!testEnvConfig.UI_CONFIG_SIGNATURE_PRIVATE_KEY) {
    return;
  }

  const uiConfig = await getSignedConfig(testEnvConfig.UI_CONFIG_SIGNATURE_PRIVATE_KEY);
  await page.addInitScript(
    stringifiedConfig => {
      const { uiConfig, expectedBaseUrl } = JSON.parse(stringifiedConfig);
      if (window.location.href.startsWith(expectedBaseUrl)) {
        (window as any).__AK_INJECTED_CONFIG__ = uiConfig;
      }
    },
    JSON.stringify({ uiConfig, expectedBaseUrl: testEnvConfig.BASE_URL })
  );
}

const signedConfigCache = new Map<string, string>();
async function getSignedConfig(privateKeyPem: string) {
  if (signedConfigCache.has(privateKeyPem)) {
    return signedConfigCache.get(privateKeyPem);
  }

  const config: Partial<BrowserEnvConfig> = {
    // always pass token: https://deelopers.cloudflare.com/turnstile/troubleshooting/testing/#dummy-sitekeys-and-secret-keys
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA"
  };
  const serializedConfig = JSON.stringify(config);
  const privateKey = await importPrivateKey(privateKeyPem);
  const signatureBuffer = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, Buffer.from(serializedConfig));

  const result = `${serializedConfig}.${Buffer.from(signatureBuffer).toString("base64")}`;
  signedConfigCache.set(privateKeyPem, result);
  return result;
}

async function importPrivateKey(pem: string) {
  const der = Buffer.from(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""), "base64");

  return await crypto.subtle.importKey(
    "pkcs8",
    der,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );
}
