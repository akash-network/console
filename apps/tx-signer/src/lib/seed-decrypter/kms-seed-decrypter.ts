/** The one Cloud KMS call decrypting a seed needs, which keeps the decrypter buildable against any client offering it. */
export interface KmsDecryptClient {
  decrypt(request: { name: string; ciphertext: Uint8Array }): Promise<[{ plaintext?: Uint8Array | string | null }, ...unknown[]]>;
}

export interface SeedDecrypter {
  decrypt(ciphertext: Uint8Array): Promise<string>;
}

/** Decrypts with one Cloud KMS symmetric key, addressed by its full resource name. */
export class KmsSeedDecrypter implements SeedDecrypter {
  constructor(
    private readonly client: KmsDecryptClient,
    private readonly keyName: string
  ) {}

  async decrypt(ciphertext: Uint8Array): Promise<string> {
    const [{ plaintext }] = await this.client.decrypt({ name: this.keyName, ciphertext });

    if (!plaintext?.length) {
      throw new Error(`Key ${this.keyName} returned no plaintext`);
    }

    return (typeof plaintext === "string" ? Buffer.from(plaintext, "base64") : Buffer.from(plaintext)).toString("utf8");
  }
}
