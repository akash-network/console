import { grpc } from "google-gax";
import type { CompactJWEHeaderParameters } from "jose";
import { CompactEncrypt } from "jose";
import { Err, Ok, Result } from "ts-results";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { TxService } from "@src/core/services";
import type { DryRunOptions } from "@src/core/types/console";
import type { SdlSecretsKmsTarget } from "@src/deployment/providers/kms.provider";
import { SDL_SECRETS_KMS_TARGET } from "@src/deployment/providers/kms.provider";
import { KmsWrappedJweService } from "@src/deployment/services/kms-wrapped-jwe/kms-wrapped-jwe.service";
import type { SdlSecretsSealingKey } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import type { StoredSecretFingerprint, StoredSecretSnapshot } from "@src/deployment/services/stored-secret-fingerprint/stored-secret-fingerprint.service";
import { StoredSecretFingerprintService } from "@src/deployment/services/stored-secret-fingerprint/stored-secret-fingerprint.service";
import { DEFAULT_KEY_ROTATION_BATCH_SIZE, ENABLED_CRYPTO_KEY_VERSION_STATES } from "@src/secret/config/key-rotation.config";
import type { DataKeyOutput } from "@src/secret/repositories/data-key/data-key.repository";
import { DataKeyRepository } from "@src/secret/repositories/data-key/data-key.repository";

export interface RotateDataKeysOptions extends DryRunOptions {
  targetVersion: string;
  batchSize?: number;
}

export interface DataKeyRotationReport {
  usersReWrapped: number;
  wouldReWrap: number;
  secretsReEncrypted: number;
  concurrentSecretWrites: number;
  skippedForeignWrap: number;
  failed: number;
  bytesRewritten: number;
  elapsedMs: number;
  fingerprintBefore: StoredSecretFingerprint;
  fingerprintAfter: StoredSecretFingerprint;
  fromVersions: Record<string, number>;
  toVersion: string;
  dataKeysByVersion: Record<string, number>;
}

/** Carries the report alongside the reason, because a run that ends in a refusal is exactly the run whose numbers an operator has to read. */
export interface DataKeyRotationFailure {
  reason: string;
  report?: DataKeyRotationReport;
}

interface RotationProgress {
  usersReWrapped: number;
  wouldReWrap: number;
  skippedForeignWrap: number;
  failed: number;
  bytesRewritten: number;
  fromVersions: Record<string, number>;
}

interface PreparedRewrap {
  row: DataKeyOutput;
  wrappedKey: string;
}

function getGrpcStatus(error: unknown) {
  return error instanceof Error && "code" in error ? error.code : undefined;
}

/**
 * Moves every user's data encryption key onto the version the console is configured to wrap under,
 * by opening each wrap with the version its own header names and sealing the same key bytes to the
 * target's public key. Nothing a deployment stores is opened or rewritten: a stored secret is sealed
 * under the data key's identity rather than its wrapping, and the fingerprint taken on either side
 * of the run is what proves it.
 */
@singleton()
export class DataKeyRotationService {
  readonly #loggerService: ReturnType<CreateLogger>;

  constructor(
    private readonly dataKeyRepository: DataKeyRepository,
    private readonly fingerprintService: StoredSecretFingerprintService,
    private readonly wrappedJweService: KmsWrappedJweService,
    private readonly sealingKeyService: SdlSecretsSealingKeyService,
    private readonly txService: TxService,
    @inject(SDL_SECRETS_KMS_TARGET) private readonly kmsTarget: SdlSecretsKmsTarget,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#loggerService = createLogger({ context: DataKeyRotationService.name });
  }

  async rotate(options: RotateDataKeysOptions): Promise<Result<DataKeyRotationReport, DataKeyRotationFailure>> {
    const startedAt = Date.now();
    const batchSize = options.batchSize ?? DEFAULT_KEY_ROTATION_BATCH_SIZE;

    this.#loggerService.info({
      event: "KEY_ROTATION_STARTED",
      targetVersion: options.targetVersion,
      toVersion: this.kmsTarget.kid,
      batchSize,
      dryRun: options.dryRun
    });

    const sealingKey = await this.#preflight(options.targetVersion);

    if (sealingKey.err) return Err({ reason: sealingKey.val });

    const before = await this.#takeFingerprint("before", batchSize);
    const progress: RotationProgress = { usersReWrapped: 0, wouldReWrap: 0, skippedForeignWrap: 0, failed: 0, bytesRewritten: 0, fromVersions: {} };
    const walked = await this.#reWrapEveryDataKey({ sealingKey: sealingKey.val, batchSize, dryRun: options.dryRun, progress });
    const report = await this.#reportOn({ before, batchSize, progress, startedAt });

    this.#loggerService.info({ event: "KEY_ROTATION_COMPLETED", report });

    const reason = walked.err ? walked.val : this.#refusalFor(report);

    return reason ? Err({ reason, report }) : Ok(report);
  }

  /** Reads the target's state and warms its public key before anything is measured or written, so an operator pointed at a version that cannot receive a wrap is refused rather than half-served. */
  async #preflight(targetVersion: string): Promise<Result<SdlSecretsSealingKey, string>> {
    if (targetVersion !== this.kmsTarget.version) {
      this.#loggerService.error({ event: "KEY_ROTATION_TARGET_VERSION_MISMATCH", requested: targetVersion, configured: this.kmsTarget.version });

      return Err(`Requested target version ${targetVersion} is not the configured one, ${this.kmsTarget.version}`);
    }

    const state = await this.#readTargetVersionState();

    if (state.err) return state;

    if (state.val !== undefined && !ENABLED_CRYPTO_KEY_VERSION_STATES.has(state.val)) {
      this.#loggerService.error({ event: "KEY_ROTATION_TARGET_VERSION_UNUSABLE", versionName: this.kmsTarget.versionName, state: state.val });

      return Err(`Target key version ${this.kmsTarget.kid} is ${state.val} rather than enabled`);
    }

    return await this.#warmSealingKey();
  }

  /** An emulator or a future transport that cannot answer the state at all leaves the refusal to the public key fetch below, which no version that cannot receive a wrap survives either. */
  async #readTargetVersionState(): Promise<Result<unknown, string>> {
    try {
      const [version] = await this.kmsTarget.client.getCryptoKeyVersion({ name: this.kmsTarget.versionName }, { timeout: 5000 });

      return Ok(version.state ?? undefined);
    } catch (error) {
      if (getGrpcStatus(error) === grpc.status.UNIMPLEMENTED) {
        this.#loggerService.warn({ event: "KEY_ROTATION_TARGET_VERSION_STATE_UNAVAILABLE", versionName: this.kmsTarget.versionName });

        return Ok(undefined);
      }

      this.#loggerService.error({ event: "KEY_ROTATION_TARGET_VERSION_UNREADABLE", versionName: this.kmsTarget.versionName, error });

      return Err(`Target key version ${this.kmsTarget.kid} could not be read from the key service`);
    }
  }

  async #warmSealingKey(): Promise<Result<SdlSecretsSealingKey, string>> {
    try {
      return Ok(await this.sealingKeyService.getSealingKey());
    } catch (error) {
      this.#loggerService.error({ event: "KEY_ROTATION_TARGET_KEY_UNAVAILABLE", versionName: this.kmsTarget.versionName, error });

      return Err(`Target key version ${this.kmsTarget.kid} did not publish a usable key`);
    }
  }

  async #takeFingerprint(phase: "before" | "after", batchSize: number): Promise<StoredSecretSnapshot> {
    const snapshot = await this.fingerprintService.take({ batchSize });

    this.#loggerService.info({ event: "KEY_ROTATION_FINGERPRINT_TAKEN", phase, ...snapshot.fingerprint });

    return snapshot;
  }

  async #reWrapEveryDataKey(input: {
    sealingKey: SdlSecretsSealingKey;
    batchSize: number;
    dryRun: boolean;
    progress: RotationProgress;
  }): Promise<Result<void, string>> {
    const { sealingKey, batchSize, dryRun, progress } = input;

    for await (const batch of this.dataKeyRepository.findNotWrappedUnderIteratively({ wrappedByKid: this.kmsTarget.kid, batchSize })) {
      const prepared: PreparedRewrap[] = [];

      for (const row of batch) {
        const rewrap = await this.#prepareRewrap(row, sealingKey, dryRun, progress);

        if (rewrap) prepared.push(rewrap);
      }

      const committed = await this.#commitBatch(prepared, progress);

      this.#loggerService.info({
        event: "KEY_ROTATION_BATCH",
        rowCount: batch.length,
        firstId: batch[0].id,
        lastId: batch[batch.length - 1].id,
        reWrapped: committed.ok ? committed.val : 0
      });

      if (committed.err) return committed;
    }

    return Ok.EMPTY;
  }

  /** A row that cannot be moved is left out of the write set rather than aborting its batch, so one unreadable key cannot pin its neighbours to the old version on every run from now on. */
  async #prepareRewrap(row: DataKeyOutput, sealingKey: SdlSecretsSealingKey, dryRun: boolean, progress: RotationProgress): Promise<PreparedRewrap | undefined> {
    try {
      const parsed = this.wrappedJweService.parse(row.wrappedKey);
      const versionName = this.kmsTarget.resolveVersionName(parsed.header.kid);

      if (!versionName) {
        progress.skippedForeignWrap += 1;
        this.#loggerService.info({ event: "KEY_ROTATION_FOREIGN_WRAP_SKIPPED", dataKeyId: row.id, wrappedByKid: parsed.header.kid });

        return undefined;
      }

      if (dryRun) {
        progress.wouldReWrap += 1;

        return undefined;
      }

      const dataKey = await this.wrappedJweService.open(parsed, versionName);
      const wrappedKey = await new CompactEncrypt(dataKey)
        .setProtectedHeader({ ...parsed.header, kid: this.kmsTarget.kid } as CompactJWEHeaderParameters)
        .encrypt(sealingKey.publicKey);

      return { row, wrappedKey };
    } catch (error) {
      progress.failed += 1;
      this.#loggerService.error({ event: "KEY_ROTATION_DATA_KEY_FAILED", dataKeyId: row.id, wrappedByKid: row.wrappedByKid, error });

      return undefined;
    }
  }

  async #commitBatch(prepared: PreparedRewrap[], progress: RotationProgress): Promise<Result<number, string>> {
    if (prepared.length === 0) return Ok(0);

    try {
      const rewrapped = await this.txService.transaction(async () => {
        const written: PreparedRewrap[] = [];

        for (const rewrap of prepared) {
          const moved = await this.dataKeyRepository.rewrapIfStillWrappedUnder({
            id: rewrap.row.id,
            wrappedUnder: rewrap.row.wrappedByKid,
            wrappedKey: rewrap.wrappedKey,
            wrappedByKid: this.kmsTarget.kid
          });

          if (moved) written.push(rewrap);
        }

        return written;
      });

      for (const { row, wrappedKey } of rewrapped) {
        progress.usersReWrapped += 1;
        progress.bytesRewritten += Buffer.byteLength(wrappedKey, "utf8");
        progress.fromVersions[row.wrappedByKid] = (progress.fromVersions[row.wrappedByKid] ?? 0) + 1;
      }

      return Ok(rewrapped.length);
    } catch (error) {
      this.#loggerService.error({ event: "KEY_ROTATION_BATCH_FAILED", firstId: prepared[0].row.id, error });

      return Err("A batch of data keys could not be written, and was rolled back whole");
    }
  }

  async #reportOn(input: {
    before: StoredSecretSnapshot;
    batchSize: number;
    progress: RotationProgress;
    startedAt: number;
  }): Promise<DataKeyRotationReport> {
    const reconciliation = await this.fingerprintService.reconcile(input.before, { batchSize: input.batchSize });

    this.#loggerService.info({ event: "KEY_ROTATION_FINGERPRINT_TAKEN", phase: "after", ...reconciliation.after });

    if (reconciliation.unexplained.length > 0) {
      this.#loggerService.error({ event: "KEY_ROTATION_FINGERPRINT_MISMATCH", deploymentSettingIds: reconciliation.unexplained });
    }

    return {
      ...input.progress,
      secretsReEncrypted: reconciliation.unexplained.length,
      concurrentSecretWrites: reconciliation.ownerRewritten,
      elapsedMs: Date.now() - input.startedAt,
      fingerprintBefore: reconciliation.before,
      fingerprintAfter: reconciliation.after,
      toVersion: this.kmsTarget.kid,
      dataKeysByVersion: await this.dataKeyRepository.countByWrappingVersion()
    };
  }

  /** Both refusals are stated, because a run can have stepped over an unreadable key and found a stored secret changed, and the second is what the whole procedure exists to catch. */
  #refusalFor(report: DataKeyRotationReport) {
    const refusals: string[] = [];

    if (report.secretsReEncrypted > 0) {
      refusals.push(`${report.secretsReEncrypted} stored secrets changed with no write of their own behind them`);
    }

    if (report.failed > 0) {
      refusals.push(`${report.failed} data keys could not be re-wrapped`);
    }

    return refusals.length > 0 ? refusals.join("; ") : undefined;
  }
}
