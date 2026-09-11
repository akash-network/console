import { createHash } from "node:crypto";
import { singleton } from "tsyringe";

import type { SealedSecret } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";

export interface StoredSecretFingerprint {
  digest: string;
  rowCount: number;
  byteTotal: number;
}

interface StoredToken {
  digest: string;
  updatedAtMarker: string | null;
}

export interface StoredSecretSnapshot {
  fingerprint: StoredSecretFingerprint;
  tokens: Map<string, StoredToken>;
}

export interface StoredSecretReconciliation {
  before: StoredSecretFingerprint;
  after: StoredSecretFingerprint;
  ownerRewritten: number;
  created: number;
  /** A row whose secrets were deleted or cleared, which cannot be evidence that anything re-sealed a value it should never have read. */
  removed: number;
  reSealed: string[];
}

const DEFAULT_BATCH_SIZE = 100;

/** Carries the id so a token moved to another deployment shows as a change, and the byte length so no two rows combine into the same input as one longer one. */
function digestInputOf(row: SealedSecret, byteLength: number) {
  return `${row.id}:${byteLength}:${row.sealedSecrets}`;
}

function digestOf(sealedSecrets: string) {
  return createHash("sha256").update(sealedSecrets).digest("hex");
}

/** A row whose `updated_at` still reads as it did was written by nothing that goes through a repository, so a token that changed under it changed with no writer behind it. */
function wasWrittenSince(original: StoredToken, current: StoredToken) {
  if (!current.updatedAtMarker) return false;

  return current.updatedAtMarker !== original.updatedAtMarker;
}

/** Reports differences rather than throwing, because what a difference means belongs to the run being verified, not to the instrument. */
@singleton()
export class StoredSecretFingerprintService {
  constructor(private readonly deploymentSettingRepository: DeploymentSettingRepository) {}

  async take({ batchSize = DEFAULT_BATCH_SIZE }: { batchSize?: number } = {}): Promise<StoredSecretSnapshot> {
    const rows = createHash("sha256");
    const tokens = new Map<string, StoredToken>();
    let rowCount = 0;
    let byteTotal = 0;

    for await (const batch of this.deploymentSettingRepository.findSealedSecretsIteratively({ batchSize })) {
      for (const row of batch) {
        const byteLength = Buffer.byteLength(row.sealedSecrets, "utf8");

        rows.update(digestInputOf(row, byteLength));
        tokens.set(row.id, { digest: digestOf(row.sealedSecrets), updatedAtMarker: row.updatedAtMarker });
        rowCount += 1;
        byteTotal += byteLength;
      }
    }

    return { fingerprint: { digest: rows.digest("hex"), rowCount, byteTotal }, tokens };
  }

  /** Compares per row rather than by digest alone, because under live traffic the digests legitimately differ and only a per-row answer names what is behind it. */
  async reconcile(before: StoredSecretSnapshot, { batchSize }: { batchSize?: number } = {}): Promise<StoredSecretReconciliation> {
    const after = await this.take({ batchSize });
    const unseen = new Map(before.tokens);
    const reSealed: string[] = [];
    let ownerRewritten = 0;
    let created = 0;

    for (const [id, token] of after.tokens) {
      const original = unseen.get(id);
      unseen.delete(id);

      if (!original) {
        created += 1;
      } else if (original.digest !== token.digest) {
        if (wasWrittenSince(original, token)) ownerRewritten += 1;
        else reSealed.push(id);
      }
    }

    return { before: before.fingerprint, after: after.fingerprint, ownerRewritten, created, removed: unseen.size, reSealed };
  }
}
