import { createSign, generateKeyPairSync, webcrypto } from "crypto";

import type { BrowserEnvConfig } from "@src/config/env-config.schema";
import { decodeInjectedConfig } from "./decodeInjectedConfig";

describe(decodeInjectedConfig.name, () => {
  beforeAll(() => {
    if (!window.crypto.subtle) {
      Object.defineProperty(globalThis, "crypto", {
        value: webcrypto as any,
        writable: true
      });
    }
  });

  it("returns null if public key is not provided", async () => {
    let config = await decodeInjectedConfig(undefined);
    expect(config).toBeNull();

    config = await decodeInjectedConfig();
    expect(config).toBeNull();
  });

  it("returns null if __AK_INJECTED_CONFIG__ is not a string", async () => {
    (window as any).__AK_INJECTED_CONFIG__ = 1;
    let config = await decodeInjectedConfig("test pem");
    expect(config).toBeNull();

    (window as any).__AK_INJECTED_CONFIG__ = undefined;
    config = await decodeInjectedConfig("test pem");
    expect(config).toBeNull();
  });

  it("return null if __AK_INJECTED_CONFIG__ is of invalid format", async () => {
    (window as any).__AK_INJECTED_CONFIG__ = "test config";
    let config = await decodeInjectedConfig("test pem");
    expect(config).toBeNull();

    (window as any).__AK_INJECTED_CONFIG__ = "test config.";
    config = await decodeInjectedConfig("test pem");
    expect(config).toBeNull();

    (window as any).__AK_INJECTED_CONFIG__ = ".test signature";
    config = await decodeInjectedConfig("test pem");
    expect(config).toBeNull();
  });

  it("returns null if signature is invalid", async () => {
    const config = {
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test site key"
    };
    const { signedConfig } = signConfig(config);
    const { publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048
    });
    (window as any).__AK_INJECTED_CONFIG__ = signedConfig;
    const decodedConfig = await decodeInjectedConfig(publicKey.export({ type: "spki", format: "pem" }) as string);
    expect(decodedConfig).toBeNull();
  });

  it("returns null if config is not a valid JSON", async () => {
    const { signedConfig, publicKey } = signConfig({});
    const [, signature] = signedConfig.split(".", 2);
    (window as any).__AK_INJECTED_CONFIG__ = `not valid json.${signature}`;

    const decodedConfig = await decodeInjectedConfig(publicKey.export({ type: "spki", format: "pem" }) as string);
    expect(decodedConfig).toBeNull();
  });

  it("returns config if signature is valid", async () => {
    const config = {
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test site key"
    };
    const { signedConfig, publicKey } = signConfig(config);

    (window as any).__AK_INJECTED_CONFIG__ = signedConfig;
    const decodedConfig = await decodeInjectedConfig(publicKey.export({ type: "spki", format: "pem" }) as string);
    expect(decodedConfig).toEqual(config);
  });

  function signConfig(config: Partial<BrowserEnvConfig>) {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048
    });
    const serializedConfig = JSON.stringify(config);

    const sign = createSign("SHA256");
    sign.update(JSON.stringify(config));
    sign.end();
    const signature = sign.sign(privateKey, "base64");

    return {
      signedConfig: `${serializedConfig}.${signature}`,
      privateKey,
      publicKey
    };
  }
});
