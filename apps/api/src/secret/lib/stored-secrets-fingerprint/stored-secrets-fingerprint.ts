import type { Hash } from "node:crypto";
import { createHash } from "node:crypto";

export interface StoredSecretsEntry {
  id: string;
  sealedSecrets: string;
}

export interface StoredSecretsSummary {
  digest: string;
  rowCount: number;
  byteCount: number;
}

const DIGEST_ALGORITHM = "sha256";

/** A length fits in four bytes for any token a row can hold, and the framing below needs a fixed-width one. */
const LENGTH_PREFIX_BYTES = 4;

/**
 * Proof that a run of the key rotation changed no stored secret, taken over the fleet before and
 * after it. Each row is digested under its own id, so a token moved to another deployment shows up
 * as a changed fingerprint rather than as the same one; the per-row digests are combined in id
 * order at the end, so the result is a function of the rows themselves and not of the order a scan
 * happened to yield them in.
 */
export class StoredSecretsFingerprint {
  readonly #rowDigests = new Map<string, { digest: Buffer; byteCount: number }>();

  add({ id, sealedSecrets }: StoredSecretsEntry): void {
    const token = Buffer.from(sealedSecrets, "utf8");
    const hash = createHash(DIGEST_ALGORITHM);

    appendLengthPrefixed(hash, Buffer.from(id, "utf8"));
    appendLengthPrefixed(hash, token);

    this.#rowDigests.set(id, { digest: hash.digest(), byteCount: token.length });
  }

  summarize(): StoredSecretsSummary {
    const hash = createHash(DIGEST_ALGORITHM);
    let byteCount = 0;

    for (const id of [...this.#rowDigests.keys()].sort()) {
      const row = this.#rowDigests.get(id)!;

      hash.update(row.digest);
      byteCount += row.byteCount;
    }

    return { digest: hash.digest("hex"), rowCount: this.#rowDigests.size, byteCount };
  }
}

/** Without the length, a row's id and its token could be rearranged into another row's pair and digest alike. */
function appendLengthPrefixed(hash: Hash, value: Buffer) {
  const length = Buffer.alloc(LENGTH_PREFIX_BYTES);
  length.writeUInt32BE(value.length);

  hash.update(length);
  hash.update(value);
}
