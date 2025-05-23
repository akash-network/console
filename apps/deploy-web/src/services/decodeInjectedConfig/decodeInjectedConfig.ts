import type { BrowserEnvConfig } from "@src/config/env-config.schema";

export async function decodeInjectedConfig(publicPem = process.env.NEXT_PUBLIC_UI_CONFIG_PUBLIC_KEY): Promise<Partial<BrowserEnvConfig> | null> {
  if (!publicPem) return null;

  const signedConfig = (window as any).__AK_INJECTED_CONFIG__;
  if (!signedConfig || typeof signedConfig !== "string") return null;

  const [config, signature] = signedConfig.split(".", 2);
  if (!config || !signature) return null;

  const publicKey = await crypto.subtle.importKey(
    "spki",
    base64ToArrayBuffer(publicPem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["verify"]
  );
  const isValidSignature = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, base64ToArrayBuffer(signature), new TextEncoder().encode(config));
  if (!isValidSignature) return null;

  try {
    return JSON.parse(config);
  } catch {
    return null;
  }
}

function base64ToArrayBuffer(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
