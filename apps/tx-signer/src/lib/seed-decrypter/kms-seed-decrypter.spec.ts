import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { type KmsDecryptClient, KmsSeedDecrypter } from "./kms-seed-decrypter";

const KEY_NAME = "projects/console/locations/global/keyRings/tx-signer/cryptoKeys/derivation-seed";

describe(KmsSeedDecrypter.name, () => {
  it("asks its key to decrypt the ciphertext and returns the text it gets", async () => {
    const { decrypter, client } = setup();
    const ciphertext = new Uint8Array([1, 2, 3]);
    client.decrypt.mockResolvedValue([{ plaintext: Buffer.from("twelve words of a seed phrase") }]);

    await expect(decrypter.decrypt(ciphertext)).resolves.toBe("twelve words of a seed phrase");

    expect(client.decrypt).toHaveBeenCalledExactlyOnceWith({ name: KEY_NAME, ciphertext });
  });

  it("reads a plaintext the key service hands over as base64 text", async () => {
    const { decrypter, client } = setup();
    client.decrypt.mockResolvedValue([{ plaintext: Buffer.from("twelve words of a seed phrase").toString("base64") }]);

    await expect(decrypter.decrypt(new Uint8Array([1]))).resolves.toBe("twelve words of a seed phrase");
  });

  it.each([
    ["nothing", undefined],
    ["empty text", ""],
    ["null", null],
    ["empty bytes", new Uint8Array()]
  ])("fails, naming the key, when the key service returns %s", async (_case, plaintext) => {
    const { decrypter, client } = setup();
    client.decrypt.mockResolvedValue([{ plaintext }]);

    await expect(decrypter.decrypt(new Uint8Array([1]))).rejects.toThrow(`Key ${KEY_NAME} returned no plaintext`);
  });

  function setup() {
    const client = mock<KmsDecryptClient>();

    return { decrypter: new KmsSeedDecrypter(client, KEY_NAME), client };
  }
});
