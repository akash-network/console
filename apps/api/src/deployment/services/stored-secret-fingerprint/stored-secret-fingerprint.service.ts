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
  takenAtMarker: string;
}

export interface StoredSecretReconciliation {
  before: StoredSecretFingerprint;
  after: StoredSecretFingerprint;
  ownerRewritten: number;
  created: number;
  /** A row whose token a writer cleared, and a row that no longer exists at all, which nothing left behind can tell apart from a deployment its owner deleted. */
  removed: number;
  unexplained: string[];
}

const DEFAULT_BATCH_SIZE = 100;

/** Carries the id so a token moved to another deployment shows as a change, and the byte length so no two rows combine into the same input as one longer one. */
function digestInputOf(row: SealedSecret, byteLength: number) {
  return `${row.id}:${byteLength}:${row.sealedSecrets}`;
}

function digestOf(sealedSecrets: string) {
  return createHash("sha256").update(sealedSecrets).digest("hex");
}

/** Both writers of a stored token stamp `updated_at` in the same statement, so a row whose stamp still reads as it did was written by nothing that goes through a repository. */
function stampMoved(previous: string | null, current: string | null) {
  return current !== null && current !== previous;
}

/** Markers are fixed-width and ordered as text, so a token found under a stamp below the one the run opened with arrived without a write behind it. */
function stampedSince(marker: string | null, runOpenedAt: string) {
  return marker !== null && marker >= runOpenedAt;
}

/** Reports differences rather than throwing, because what a difference means belongs to the run being verified, not to the instrument. */
@singleton()
export class StoredSecretFingerprintService {
  constructor(private readonly deploymentSettingRepository: DeploymentSettingRepository) {}

  async take({ batchSize = DEFAULT_BATCH_SIZE }: { batchSize?: number } = {}): Promise<StoredSecretSnapshot> {
    const takenAtMarker = await this.deploymentSettingRepository.readCurrentUpdatedAtMarker();
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

    return { fingerprint: { digest: rows.digest("hex"), rowCount, byteTotal }, tokens, takenAtMarker };
  }

  /** Compares per row rather than by digest alone, because under live traffic the digests legitimately differ and only a per-row answer names what is behind it. */
  async reconcile(before: StoredSecretSnapshot, { batchSize = DEFAULT_BATCH_SIZE }: { batchSize?: number } = {}): Promise<StoredSecretReconciliation> {
    const after = await this.take({ batchSize });
    const vanished = new Map(before.tokens);
    const unexplained: string[] = [];
    let ownerRewritten = 0;
    let created = 0;

    for (const [id, token] of after.tokens) {
      const original = vanished.get(id);
      vanished.delete(id);

      if (!original) {
        if (stampedSince(token.updatedAtMarker, before.takenAtMarker)) created += 1;
        else unexplained.push(id);
      } else if (original.digest !== token.digest) {
        if (stampMoved(original.updatedAtMarker, token.updatedAtMarker)) ownerRewritten += 1;
        else unexplained.push(id);
      }
    }

    const gone = await this.#classifyVanished(vanished, batchSize);

    return {
      before: before.fingerprint,
      after: after.fingerprint,
      ownerRewritten,
      created,
      removed: gone.removed,
      unexplained: [...unexplained, ...gone.unexplained]
    };
  }

  /** The sweep only reads rows that carry a token, so a row that lost one has to be asked for its stamp directly rather than read off the second sweep. */
  async #classifyVanished(vanished: Map<string, StoredToken>, batchSize: number) {
    const entries = [...vanished];
    const unexplained: string[] = [];
    let removed = 0;

    for (let start = 0; start < entries.length; start += batchSize) {
      const chunk = entries.slice(start, start + batchSize);
      const markers = await this.deploymentSettingRepository.findUpdatedAtMarkers(chunk.map(([id]) => id));

      for (const [id, original] of chunk) {
        if (!markers.has(id) || stampMoved(original.updatedAtMarker, markers.get(id) ?? null)) removed += 1;
        else unexplained.push(id);
      }
    }

    return { removed, unexplained };
  }
}
