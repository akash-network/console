import { fromBase64 } from "@cosmjs/encoding";

import type { RemoteSigningKey } from "./kms-wallet";

type KmsResponse<T> = Promise<[T, ...unknown[]]>;

/** The two Cloud KMS calls a signing key needs, which keeps the wallet buildable against any client offering them. */
export interface KmsAsymmetricKeyClient {
  getPublicKey(request: { name: string }): KmsResponse<{ pem?: string | null }>;
  asymmetricSign(request: { name: string; digest: { sha256: Uint8Array } }): KmsResponse<{ name?: string | null; signature?: Uint8Array | string | null }>;
}

/** One Cloud KMS key version, addressed by its full resource name. */
export class KmsSigningKey implements RemoteSigningKey {
  constructor(
    private readonly client: KmsAsymmetricKeyClient,
    private readonly keyVersionName: string
  ) {}

  async getPublicKeyPem(): Promise<string> {
    const [{ pem }] = await this.client.getPublicKey({ name: this.keyVersionName });

    if (!pem) {
      throw new Error(`Key version ${this.keyVersionName} returned no public key`);
    }

    return pem;
  }

  async signSha256Digest(digest: Uint8Array): Promise<Uint8Array> {
    const [{ name, signature }] = await this.client.asymmetricSign({ name: this.keyVersionName, digest: { sha256: digest } });

    if (name !== this.keyVersionName) {
      throw new Error(`Asked ${this.keyVersionName} to sign, but ${name || "an unnamed key"} answered`);
    }

    if (!signature) {
      throw new Error(`Key version ${this.keyVersionName} returned no signature`);
    }

    return typeof signature === "string" ? fromBase64(signature) : Uint8Array.from(signature);
  }
}
