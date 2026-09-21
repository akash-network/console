import { base64url } from "jose";
import { describe, expect, it } from "vitest";

import type { SdlSecretValues } from "./sdlSecrets";
import { SDL_SECRETS_SEAL_LIFETIME_SECONDS, sealSdlSecrets } from "./sealSdlSecrets";

const SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n';

describe(sealSdlSecrets.name, () => {
  it("produces a compact JWE the sealing key opens back to the secrets", async () => {
    const { seal, open } = await setup();

    const { secrets } = await open(await seal({ secrets: { TOKEN: "t", DB_URL: "postgres://u:p@h/db" } }));

    expect(secrets).toEqual({ TOKEN: "t", DB_URL: "postgres://u:p@h/db" });
  });

  it("seals an empty set, which is how a deployment without secrets still states which values are secret", async () => {
    const { seal, open } = await setup();

    const { secrets } = await open(await seal({ secrets: {} }));

    expect(secrets).toEqual({});
  });

  it("uses the algorithms the api accepts and names the key version and user it was sealed for", async () => {
    const { seal, open } = await setup();

    const { header } = await open(await seal({}));

    expect(header).toMatchObject({ alg: "RSA-OAEP-256", enc: "A256GCM", kid: "sdl-secrets.v1", sub: "user-1" });
  });

  it("expires the seal after its lifetime, which sits well inside the api's fifteen-minute ceiling", async () => {
    const { seal, open } = await setup();
    const sealedAt = Math.floor(Date.now() / 1000);

    const { header } = await open(await seal({}));

    expect(header.exp).toBeGreaterThanOrEqual(sealedAt + SDL_SECRETS_SEAL_LIFETIME_SECONDS);
    expect(header.exp).toBeLessThan(sealedAt + SDL_SECRETS_SEAL_LIFETIME_SECONDS + 5);
    expect(SDL_SECRETS_SEAL_LIFETIME_SECONDS).toBeLessThan(15 * 60);
  });

  it("binds the seal to the exact SDL string it accompanies", async () => {
    const { seal, open } = await setup();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SDL));

    const { header } = await open(await seal({ sdl: SDL }));

    expect(header.sdlHash).toBe(base64url.encode(new Uint8Array(digest)));
  });

  it("binds to no SDL when none is given, for a seal a patch presents against the stored document", async () => {
    const { context, open } = await setup();

    const { header } = await open(await sealSdlSecrets({ context, secrets: { TOKEN: "t" } }));

    expect(header).not.toHaveProperty("sdlHash");
  });

  async function setup() {
    const keyPair = await crypto.subtle.generateKey(
      { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["encrypt", "decrypt"]
    );
    const { kty, n, e } = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const context = { kid: "sdl-secrets.v1", sub: "user-1", jwk: { kty: kty as string, n: n as string, e: e as string, use: "enc", alg: "RSA-OAEP-256" } };

    return {
      context,
      seal: (input: { secrets?: SdlSecretValues; sdl?: string }) => sealSdlSecrets({ context, sdl: input.sdl ?? SDL, secrets: input.secrets ?? {} }),
      open: (token: string) => openCompactJwe(token, keyPair.privateKey)
    };
  }

  /** Opens the seal with WebCrypto alone, the way any standards-following consumer would, rather than with the library that made it. */
  async function openCompactJwe(token: string, privateKey: CryptoKey) {
    const [protectedHeader, encryptedKey, iv, ciphertext, tag] = token.split(".");
    const contentKey = await crypto.subtle.importKey(
      "raw",
      await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, base64url.decode(encryptedKey)),
      "AES-GCM",
      false,
      ["decrypt"]
    );
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64url.decode(iv), additionalData: new TextEncoder().encode(protectedHeader), tagLength: 128 },
      contentKey,
      concatBytes(base64url.decode(ciphertext), base64url.decode(tag))
    );

    return {
      secrets: JSON.parse(new TextDecoder().decode(plaintext)) as SdlSecretValues,
      header: JSON.parse(new TextDecoder().decode(base64url.decode(protectedHeader))) as Record<string, unknown>
    };
  }

  function concatBytes(head: Uint8Array, tail: Uint8Array): Uint8Array {
    const joined = new Uint8Array(head.length + tail.length);
    joined.set(head);
    joined.set(tail, head.length);
    return joined;
  }
});
