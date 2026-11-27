import { toBase64 } from "@cosmjs/encoding";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { type KmsAsymmetricKeyClient, KmsSigningKey } from "./kms-signing-key";

const KEY_VERSION = "projects/console/locations/global/keyRings/tx-signer/cryptoKeys/funding/cryptoKeyVersions/1";
const DIGEST = Uint8Array.from({ length: 32 }, (_, index) => index);
const SIGNATURE = Uint8Array.from([48, 6, 2, 1, 1, 2, 1, 2]);

describe(KmsSigningKey.name, () => {
  describe("getPublicKeyPem", () => {
    it("returns the PEM of the key version it was built for", async () => {
      const { key, client } = setup();
      client.getPublicKey.mockResolvedValue([{ pem: "-----BEGIN PUBLIC KEY-----" }]);

      await expect(key.getPublicKeyPem()).resolves.toBe("-----BEGIN PUBLIC KEY-----");

      expect(client.getPublicKey).toHaveBeenCalledWith({ name: KEY_VERSION });
    });

    it("refuses an answer without a public key", async () => {
      const { key, client } = setup();
      client.getPublicKey.mockResolvedValue([{ pem: null }]);

      await expect(key.getPublicKeyPem()).rejects.toThrow(`Key version ${KEY_VERSION} returned no public key`);
    });
  });

  describe("signSha256Digest", () => {
    it("asks the key version to sign the digest and returns the signature bytes", async () => {
      const { key, client } = setup();
      client.asymmetricSign.mockResolvedValue([{ name: KEY_VERSION, signature: Buffer.from(SIGNATURE) }]);

      const signature = await key.signSha256Digest(DIGEST);

      expect(signature).toEqual(SIGNATURE);
      expect(Buffer.isBuffer(signature)).toBe(false);
      expect(client.asymmetricSign).toHaveBeenCalledWith({ name: KEY_VERSION, digest: { sha256: DIGEST } });
    });

    it("decodes a signature the client hands back as base64", async () => {
      const { key, client } = setup();
      client.asymmetricSign.mockResolvedValue([{ name: KEY_VERSION, signature: toBase64(SIGNATURE) }]);

      await expect(key.signSha256Digest(DIGEST)).resolves.toEqual(SIGNATURE);
    });

    it("refuses a signature another key version produced", async () => {
      const { key, client } = setup();
      const otherVersion = KEY_VERSION.replace(/1$/, "2");
      client.asymmetricSign.mockResolvedValue([{ name: otherVersion, signature: SIGNATURE }]);

      await expect(key.signSha256Digest(DIGEST)).rejects.toThrow(`Asked ${KEY_VERSION} to sign, but ${otherVersion} answered`);
    });

    it("refuses an answer that names no key version", async () => {
      const { key, client } = setup();
      client.asymmetricSign.mockResolvedValue([{ name: "", signature: SIGNATURE }]);

      await expect(key.signSha256Digest(DIGEST)).rejects.toThrow(`Asked ${KEY_VERSION} to sign, but an unnamed key answered`);
    });

    it("refuses an answer without a signature", async () => {
      const { key, client } = setup();
      client.asymmetricSign.mockResolvedValue([{ name: KEY_VERSION, signature: null }]);

      await expect(key.signSha256Digest(DIGEST)).rejects.toThrow(`Key version ${KEY_VERSION} returned no signature`);
    });
  });

  function setup() {
    const client = mock<KmsAsymmetricKeyClient>();

    return { key: new KmsSigningKey(client, KEY_VERSION), client };
  }
});
