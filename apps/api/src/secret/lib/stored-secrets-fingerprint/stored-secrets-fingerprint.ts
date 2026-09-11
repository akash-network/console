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

/** Digests each row under its own id and combines the row digests in id order, so the result reflects the rows themselves rather than the order a scan yielded them in. */
export class StoredSecretsFingerprint {
  readonly #rowDigests = new Map<string, { digest: Buffer; byteCount: number }>();

  add({ id, sealedSecrets }: StoredSecretsEntry): void {
    const token = Buffer.from(sealedSecrets, "utf8");
    const hash = createHash(DIGEST_ALGORITHM);

    appendLengthPrefixed(hash, Buffer.from(id, "utf8"));
    appendLengthPrefixed(hash, token);

    this.#rowDigests.set(id, { digest: hash.digest(), byteCount: token.length });
  }

  /** How many rows hold a different token than they did in `other`, counting one that arrived or disappeared as a difference of its own. */
  countDifferencesFrom(other: StoredSecretsFingerprint): number {
    const ids = new Set([...this.#rowDigests.keys(), ...other.#rowDigests.keys()]);
    let differences = 0;

    for (const id of ids) {
      const mine = this.#rowDigests.get(id);
      const theirs = other.#rowDigests.get(id);

      if (!mine || !theirs || !mine.digest.equals(theirs.digest)) {
        differences++;
      }
    }

    return differences;
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
