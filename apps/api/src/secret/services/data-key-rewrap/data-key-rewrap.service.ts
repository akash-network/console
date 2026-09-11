import { protos } from "@google-cloud/kms";
import type { CompactJWEHeaderParameters } from "jose";
import { CompactEncrypt } from "jose";
import { Err, Ok, type Result } from "ts-results";
import { inject, singleton } from "tsyringe";

import { assertBatchSize } from "@src/core/lib/batch-size/batch-size";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { TxService } from "@src/core/services";
import type { SdlSecretsKmsTarget, SdlSecretsKmsTargetFactory } from "@src/deployment/providers/kms.provider";
import { SDL_SECRETS_KMS_TARGET_FACTORY } from "@src/deployment/providers/kms.provider";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { ParsedKmsWrappedJwe } from "@src/deployment/services/kms-wrapped-jwe/kms-wrapped-jwe.service";
import { KmsWrappedJweService } from "@src/deployment/services/kms-wrapped-jwe/kms-wrapped-jwe.service";
import type { SdlSecretsSealingKey } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import type { StoredSecretsDrift, StoredSecretsSummary } from "@src/secret/lib/stored-secrets-fingerprint/stored-secrets-fingerprint";
import { StoredSecretsFingerprint } from "@src/secret/lib/stored-secrets-fingerprint/stored-secrets-fingerprint";
import type { DataKeyOutput } from "@src/secret/repositories/data-key/data-key.repository";
import { DataKeyRepository } from "@src/secret/repositories/data-key/data-key.repository";

const { CryptoKeyVersionState } = protos.google.cloud.kms.v1.CryptoKeyVersion;

/** Holds both encodings of the state, because the Cloud KMS API reports an enum as either its name or its ordinal. */
const ENABLED_KEY_VERSION_STATES: ReadonlySet<unknown> = new Set(["ENABLED", CryptoKeyVersionState.ENABLED]);

const DEFAULT_BATCH_SIZE = 100;

export interface DataKeyRewrapOptions {
  targetVersion: string;
  batchSize?: number;
  dryRun: boolean;
}

export interface DataKeyRewrapReport {
  dryRun: boolean;
  toVersion: string;
  fromVersions: string[];
  census: Record<string, number>;
  dataKeysRewrapped: number;
  dataKeysFailed: number;
  secretsDrift?: StoredSecretsDrift;
  bytesRewritten: number;
  elapsedMs: number;
  fingerprint: { before: StoredSecretsSummary; after?: StoredSecretsSummary };
}

/** Re-wraps every user's data key onto one KMS key version so the versions left behind can be disabled, and proves through the fingerprint drift that it left every stored secret untouched. */
@singleton()
export class DataKeyRewrapService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly dataKeyRepository: DataKeyRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly wrappedJweService: KmsWrappedJweService,
    private readonly txService: TxService,
    @inject(SDL_SECRETS_KMS_TARGET_FACTORY) private readonly createKmsTarget: SdlSecretsKmsTargetFactory,
    @inject(LOGGER_FACTORY) private readonly createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: DataKeyRewrapService.name });
  }

  async rewrapDataKeys({ targetVersion, batchSize, dryRun }: DataKeyRewrapOptions): Promise<Result<DataKeyRewrapReport, unknown[]>> {
    const startedAt = Date.now();
    const pageSize = assertBatchSize(batchSize ?? DEFAULT_BATCH_SIZE);
    const target = this.createKmsTarget(targetVersion);
    const sealingKey = await this.#assertUsableTarget(target);

    this.logger.info({ event: "DATA_KEY_REWRAP_START", toVersion: target.kid, batchSize: pageSize, dryRun });

    const before = await this.#fingerprintStoredSecrets(pageSize);
    const census = await this.#censusByVersion();
    const errors: unknown[] = [];
    let rewrapped = 0;
    let bytesRewritten = 0;

    for await (const batch of this.dataKeyRepository.findWrappedUnderOtherVersionsIteratively({ targetKid: target.kid, batchSize: pageSize })) {
      if (dryRun) {
        rewrapped += this.#auditBatch(batch, target, errors);
        continue;
      }

      const wrappings = await this.#rewrapBatch(batch, target, sealingKey, errors);

      await this.txService.transaction(async () => {
        for (const { id, wrappedKey } of wrappings) {
          await this.dataKeyRepository.updateById(id, { wrappedKey, wrappedByKid: target.kid });
        }
      });

      rewrapped += wrappings.length;
      bytesRewritten += wrappings.reduce((total, { wrappedKey }) => total + Buffer.byteLength(wrappedKey), 0);
      this.logger.info({ event: "DATA_KEY_REWRAP_BATCH", rewrapped, failed: errors.length, bytesRewritten });
    }

    const after = dryRun ? undefined : await this.#fingerprintStoredSecrets(pageSize);
    const report: DataKeyRewrapReport = {
      dryRun,
      toVersion: target.kid,
      fromVersions: Object.keys(census).filter(kid => kid !== target.kid),
      census,
      dataKeysRewrapped: rewrapped,
      dataKeysFailed: errors.length,
      secretsDrift: after?.driftFrom(before),
      bytesRewritten,
      elapsedMs: Date.now() - startedAt,
      fingerprint: { before: before.summarize(), after: after?.summarize() }
    };

    this.#assertStoredSecretsUntouched(report);
    this.logger.info({ event: "DATA_KEY_REWRAP_END", report });

    return errors.length > 0 ? Err(errors) : Ok(report);
  }

  /** The public key alone cannot answer this: Cloud KMS refuses a disabled version's key, but the emulator serves it. */
  async #assertUsableTarget(target: SdlSecretsKmsTarget): Promise<SdlSecretsSealingKey> {
    const [version] = await target.client.getCryptoKeyVersion({ name: target.versionName });

    if (!ENABLED_KEY_VERSION_STATES.has(version.state)) {
      this.logger.error({ event: "DATA_KEY_REWRAP_TARGET_UNUSABLE", toVersion: target.kid, state: version.state });

      throw new Error(`Key version ${target.kid} is not enabled`);
    }

    return await new SdlSecretsSealingKeyService(target, this.createLogger).getSealingKey();
  }

  async #fingerprintStoredSecrets(batchSize: number): Promise<StoredSecretsFingerprint> {
    const fingerprint = new StoredSecretsFingerprint();

    for await (const batch of this.deploymentSettingRepository.findStoredSecretsIteratively({ batchSize })) {
      for (const storedSecrets of batch) {
        fingerprint.add(storedSecrets);
      }
    }

    return fingerprint;
  }

  async #censusByVersion(): Promise<Record<string, number>> {
    const census = await this.dataKeyRepository.countByWrappingVersion();

    return Object.fromEntries(census.map(({ wrappedByKid, count }) => [wrappedByKid, count]));
  }

  /** Counts only rows a real run could move, so the dry-run promise holds for corrupted and foreign rows too — without spending a KMS unwrap on any of them. */
  #auditBatch(batch: DataKeyOutput[], target: SdlSecretsKmsTarget, errors: unknown[]): number {
    let resolvable = 0;

    for (const row of batch) {
      try {
        this.#parseWrapping(row, target);
        resolvable += 1;
      } catch (error) {
        this.#recordRowFailure(row, error, errors);
      }
    }

    return resolvable;
  }

  /** A row nothing can open is recorded and stepped over, because keyset selection would hand it to every re-run first and the fleet would never move off the retiring version. */
  async #rewrapBatch(
    batch: DataKeyOutput[],
    target: SdlSecretsKmsTarget,
    sealingKey: SdlSecretsSealingKey,
    errors: unknown[]
  ): Promise<Array<{ id: string; wrappedKey: string }>> {
    const wrappings: Array<{ id: string; wrappedKey: string }> = [];

    for (const row of batch) {
      try {
        wrappings.push({ id: row.id, wrappedKey: await this.#rewrap(row, target, sealingKey) });
      } catch (error) {
        this.#recordRowFailure(row, error, errors);
      }
    }

    return wrappings;
  }

  #recordRowFailure(row: DataKeyOutput, error: unknown, errors: unknown[]) {
    errors.push(error);
    this.logger.error({ event: "DATA_KEY_REWRAP_ROW_FAILED", dataKeyId: row.id, userId: row.userId, wrappedByKid: row.wrappedByKid, error });
  }

  #parseWrapping(row: DataKeyOutput, target: SdlSecretsKmsTarget): { parsed: ParsedKmsWrappedJwe; versionName: string } {
    const parsed = this.wrappedJweService.parse(row.wrappedKey);
    const versionName = target.resolveVersionName(parsed.header.kid);

    if (!versionName) {
      throw new Error(`Data key ${row.id} names a key version this console cannot resolve`);
    }

    return { parsed, versionName };
  }

  /** The unwrap is the only call the key service sees; wrapping again spends only the public half already in memory. */
  async #rewrap(row: DataKeyOutput, target: SdlSecretsKmsTarget, sealingKey: SdlSecretsSealingKey): Promise<string> {
    const { parsed, versionName } = this.#parseWrapping(row, target);
    const dataKey = await this.wrappedJweService.open(parsed, versionName);

    return await new CompactEncrypt(dataKey)
      .setProtectedHeader({ ...parsed.header, kid: sealingKey.kid } as CompactJWEHeaderParameters)
      .encrypt(sealingKey.publicKey);
  }

  /** Concurrent user writes move the digest legitimately, so only a row changed without its `updatedAt` moving fails the run. */
  #assertStoredSecretsUntouched(report: DataKeyRewrapReport) {
    const drift = report.secretsDrift;

    if (!drift) {
      return;
    }

    if (drift.changedConcurrently > 0 || drift.added > 0 || drift.removed > 0) {
      this.logger.warn({ event: "DATA_KEY_REWRAP_SECRETS_CHANGED_CONCURRENTLY", drift });
    }

    if (drift.corruptedIds.length === 0) {
      return;
    }

    this.logger.error({ event: "DATA_KEY_REWRAP_FINGERPRINT_MISMATCH", report });

    throw new Error(`Stored secrets changed while re-wrapping onto ${report.toVersion}`);
  }
}
