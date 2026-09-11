import { protos } from "@google-cloud/kms";
import type { CompactJWEHeaderParameters } from "jose";
import { CompactEncrypt } from "jose";
import { Err, Ok, type Result } from "ts-results";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { TxService } from "@src/core/services";
import type { SdlSecretsKmsTarget, SdlSecretsKmsTargetFactory } from "@src/deployment/providers/kms.provider";
import { SDL_SECRETS_KMS_TARGET_FACTORY } from "@src/deployment/providers/kms.provider";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { KmsWrappedJweService } from "@src/deployment/services/kms-wrapped-jwe/kms-wrapped-jwe.service";
import type { SdlSecretsSealingKey } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import type { StoredSecretsSummary } from "@src/secret/lib/stored-secrets-fingerprint/stored-secrets-fingerprint";
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
  secretsReEncrypted: number;
  bytesRewritten: number;
  elapsedMs: number;
  fingerprint: { before: StoredSecretsSummary; after?: StoredSecretsSummary };
}

/**
 * Moves every user's data encryption key onto a KMS key version, so the versions it leaves behind
 * can be disabled. A data key is re-wrapped, never replaced, and a deployment's secrets are sealed
 * to the data key's identity rather than to its wrapping — so this rewrites one row per user and
 * must leave every stored secret exactly as it found it, which the fingerprint either side proves.
 */
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
    const pageSize = this.#assertUsableBatchSize(batchSize ?? DEFAULT_BATCH_SIZE);
    const target = this.createKmsTarget(targetVersion);
    const sealingKey = await this.#assertUsableTarget(target);

    this.logger.info({ event: "DATA_KEY_REWRAP_START", toVersion: target.kid, batchSize: pageSize, dryRun });

    const before = await this.#fingerprintStoredSecrets(pageSize);
    const census = await this.#censusByVersion();
    const errors: unknown[] = [];
    let rewrapped = dryRun ? countAwayFrom(census, target.kid) : 0;
    let bytesRewritten = 0;

    if (!dryRun) {
      for await (const batch of this.dataKeyRepository.findWrappedUnderOtherVersionsIteratively({ targetKid: target.kid, batchSize: pageSize })) {
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
    }

    const after = dryRun ? undefined : await this.#fingerprintStoredSecrets(pageSize);
    const report: DataKeyRewrapReport = {
      dryRun,
      toVersion: target.kid,
      fromVersions: Object.keys(census).filter(kid => kid !== target.kid),
      census,
      dataKeysRewrapped: rewrapped,
      dataKeysFailed: errors.length,
      secretsReEncrypted: after ? before.countDifferencesFrom(after) : 0,
      bytesRewritten,
      elapsedMs: Date.now() - startedAt,
      fingerprint: { before: before.summarize(), after: after?.summarize() }
    };

    this.#assertStoredSecretsUntouched(report);
    this.logger.info({ event: "DATA_KEY_REWRAP_END", report });

    return errors.length > 0 ? Err(errors) : Ok(report);
  }

  #assertUsableBatchSize(batchSize: number): number {
    if (!Number.isInteger(batchSize) || batchSize < 1) {
      throw new Error(`Batch size must be a positive integer, got ${batchSize}`);
    }

    return batchSize;
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

  /**
   * A row nothing can open is recorded and stepped over rather than aborting the run: selection is
   * keyset-paged, so a row that failed the whole run would be the first one every re-run picks, and
   * the rest of the fleet would never move off the version the operator is trying to retire.
   */
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
        errors.push(error);
        this.logger.error({ event: "DATA_KEY_REWRAP_ROW_FAILED", dataKeyId: row.id, userId: row.userId, wrappedByKid: row.wrappedByKid, error });
      }
    }

    return wrappings;
  }

  /** The unwrap is the only call the key service sees; wrapping again spends only the public half already in memory. */
  async #rewrap(row: DataKeyOutput, target: SdlSecretsKmsTarget, sealingKey: SdlSecretsSealingKey): Promise<string> {
    const parsed = this.wrappedJweService.parse(row.wrappedKey);
    const versionName = target.resolveVersionName(parsed.header.kid);

    if (!versionName) {
      throw new Error(`Data key ${row.id} names a key version this console cannot resolve`);
    }

    const dataKey = await this.wrappedJweService.open(parsed, versionName);

    return await new CompactEncrypt(dataKey)
      .setProtectedHeader({ ...parsed.header, kid: sealingKey.kid } as CompactJWEHeaderParameters)
      .encrypt(sealingKey.publicKey);
  }

  #assertStoredSecretsUntouched(report: DataKeyRewrapReport) {
    const { before, after } = report.fingerprint;

    if (!after || (after.digest === before.digest && after.rowCount === before.rowCount && after.byteCount === before.byteCount)) {
      return;
    }

    this.logger.error({ event: "DATA_KEY_REWRAP_FINGERPRINT_MISMATCH", report });

    throw new Error(`Stored secrets changed while re-wrapping onto ${report.toVersion}`);
  }
}

function countAwayFrom(census: Record<string, number>, targetKid: string): number {
  return Object.entries(census).reduce((total, [kid, count]) => (kid === targetKid ? total : total + count), 0);
}
