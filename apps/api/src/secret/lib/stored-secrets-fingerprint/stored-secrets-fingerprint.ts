import type { Hash } from "node:crypto";
import { createHash } from "node:crypto";

export interface StoredSecretsEntry {
  id: string;
  sealedSecrets: string;
  updatedAt: Date | null;
}

export interface StoredSecretsDrift {
  corruptedIds: string[];
  changedConcurrently: number;
  added: number;
  removed: number;
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
  readonly #rowDigests = new Map<string, { digest: Buffer; byteCount: number; updatedAtMs: number | null }>();

  add({ id, sealedSecrets, updatedAt }: StoredSecretsEntry): void {
    const token = Buffer.from(sealedSecrets, "utf8");
    const hash = createHash(DIGEST_ALGORITHM);

    appendLengthPrefixed(hash, Buffer.from(id, "utf8"));
    appendLengthPrefixed(hash, token);

    this.#rowDigests.set(id, { digest: hash.digest(), byteCount: token.length, updatedAtMs: updatedAt?.getTime() ?? null });
  }

  /** A token that changed while its row's `updatedAt` stood still is corruption, because every legitimate secrets write bumps that timestamp. */
  driftFrom(before: StoredSecretsFingerprint): StoredSecretsDrift {
    const drift: StoredSecretsDrift = { corruptedIds: [], changedConcurrently: 0, added: 0, removed: 0 };

    for (const id of new Set([...this.#rowDigests.keys(), ...before.#rowDigests.keys()])) {
      const current = this.#rowDigests.get(id);
      const previous = before.#rowDigests.get(id);

      if (!previous) {
        drift.added++;
      } else if (!current) {
        drift.removed++;
      } else if (!current.digest.equals(previous.digest)) {
        if (current.updatedAtMs === previous.updatedAtMs) {
          drift.corruptedIds.push(id);
        } else {
          drift.changedConcurrently++;
        }
      }
    }

    return drift;
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
