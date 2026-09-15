import { decodeProtectedHeader } from "jose";
import { Err, Ok, type Result } from "ts-results";
import { inject, singleton } from "tsyringe";

import { assertBatchSize } from "@src/core/lib/batch-size/batch-size";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { DeploymentStoredSecretsOfUser } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";
import type { DataKeyOutput } from "@src/secret/repositories/data-key/data-key.repository";
import { DataKeyRepository } from "@src/secret/repositories/data-key/data-key.repository";
import { wrapDataKey } from "@src/secret/services/data-key/data-key.service";
import { UserRepository } from "@src/user/repositories";

const DEFAULT_BATCH_SIZE = 100;

/** A request that read the active key just before it was retired may still write a value under it, so the retired row outlives the pass by at least this long and a later run deletes it. */
export const MIN_RETIREMENT_AGE_BEFORE_DELETE_MS = 60_000;

export interface DataKeyRekeyOptions {
  userId: string;
  dryRun: boolean;
  batchSize?: number;
}

export interface DataKeyRekeyReport {
  userId: string;
  dryRun: boolean;
  activeDataKeyId: string;
  retiredDataKeyId: string | null;
  deploymentsResealed: number;
  secretsResealed: number;
  deploymentsAlreadyUnderActiveKey: number;
  deploymentsMovedByAnotherWriter: number;
  deploymentsUnderUnknownKey: string[];
  retiredDataKeyDeleted: boolean;
  retiredDataKeyDeletableAfter: Date | null;
  elapsedMs: number;
}

/** Which key the pass moves values off and which it seals them under; on a fresh dry run nothing is retired yet, so the active key is the source and there is no target. */
interface RekeyKeys {
  active: DataKeyOutput;
  retired: DataKeyOutput | undefined;
  sourceId: string;
  targetId: string | undefined;
}

interface ResealPass {
  deploymentsResealed: number;
  secretsResealed: number;
  deploymentsAlreadyUnderActiveKey: number;
  deploymentsMovedByAnotherWriter: number;
  deploymentsUnderUnknownKey: string[];
  errors: unknown[];
}

function kidOf(sealedSecrets: string): unknown {
  try {
    return decodeProtectedHeader(sealedSecrets).kid;
  } catch {
    return undefined;
  }
}

/** Re-wrapping under a new KMS version leaves a leaked data key itself unchanged, so containing the leak means a new key with every stored secret re-sealed under it while both stay openable. */
@singleton()
export class DataKeyRekeyService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly dataKeyRepository: DataKeyRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly userRepository: UserRepository,
    private readonly sdlSecretsService: SdlSecretsService,
    private readonly sealingKeyService: SdlSecretsSealingKeyService,
    private readonly txService: TxService,
    private readonly executionContextService: ExecutionContextService,
    @inject(LOGGER_FACTORY) private readonly createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: DataKeyRekeyService.name });
  }

  async rekeyUser({ userId, dryRun, batchSize }: DataKeyRekeyOptions): Promise<Result<DataKeyRekeyReport, unknown[]>> {
    const startedAt = Date.now();
    const pageSize = assertBatchSize(batchSize ?? DEFAULT_BATCH_SIZE);
    await this.#assertUserExists(userId);
    const keys = await this.#resolveKeys(userId, dryRun);

    this.logger.info({ event: "DATA_KEY_REKEY_START", userId, activeDataKeyId: keys.active.id, retiredDataKeyId: keys.retired?.id ?? null, dryRun });

    const pass = await this.executionContextService.runWithContext(async () => await this.#resealEveryDeployment(userId, keys, pageSize, dryRun));
    const retirement = await this.#settleRetiredKey(userId, keys.retired, pass, pageSize, dryRun);

    const report: DataKeyRekeyReport = {
      userId,
      dryRun,
      activeDataKeyId: keys.active.id,
      retiredDataKeyId: keys.retired?.id ?? null,
      deploymentsResealed: pass.deploymentsResealed,
      secretsResealed: pass.secretsResealed,
      deploymentsAlreadyUnderActiveKey: pass.deploymentsAlreadyUnderActiveKey,
      deploymentsMovedByAnotherWriter: pass.deploymentsMovedByAnotherWriter,
      deploymentsUnderUnknownKey: pass.deploymentsUnderUnknownKey,
      retiredDataKeyDeleted: retirement.deleted,
      retiredDataKeyDeletableAfter: retirement.deletableAfter,
      elapsedMs: Date.now() - startedAt
    };

    this.logger.info({ event: "DATA_KEY_REKEY_END", report });

    return pass.errors.length > 0 ? Err(pass.errors) : Ok(report);
  }

  async #assertUserExists(userId: string) {
    if (await this.userRepository.findById(userId)) return;

    this.logger.error({ event: "DATA_KEY_REKEY_USER_NOT_FOUND", userId });

    throw new Error(`No user ${userId}`);
  }

  /** A retired key left by an interrupted run is resumed rather than retired again, so every value still opens under one of exactly two keys. */
  async #resolveKeys(userId: string, dryRun: boolean): Promise<RekeyKeys> {
    const [active, retiredKeys] = await Promise.all([this.dataKeyRepository.findByUserId(userId), this.dataKeyRepository.findRetiredByUserId(userId)]);

    if (retiredKeys.length > 1) {
      this.logger.error({ event: "DATA_KEY_REKEY_SEVERAL_RETIRED_KEYS", userId, retiredDataKeyIds: retiredKeys.map(key => key.id) });

      throw new Error(`User ${userId} holds ${retiredKeys.length} retired data keys; finish the earlier re-key by hand before starting another`);
    }

    const [retired] = retiredKeys;

    if (!active) {
      this.logger.error({ event: "DATA_KEY_REKEY_NO_ACTIVE_KEY", userId, retiredDataKeyId: retired?.id ?? null });

      throw new Error(retired ? `User ${userId} holds a retired data key but no active one; restore one by hand` : `User ${userId} holds no data key`);
    }

    if (retired) {
      this.logger.info({ event: "DATA_KEY_REKEY_RESUMED", userId, activeDataKeyId: active.id, retiredDataKeyId: retired.id });

      return { active, retired, sourceId: retired.id, targetId: active.id };
    }

    if (dryRun) {
      return { active, retired: undefined, sourceId: active.id, targetId: undefined };
    }

    const replaced = await this.#retireAndReplace(userId, active);

    return { active: replaced.replacement, retired: replaced.retired, sourceId: replaced.retired.id, targetId: replaced.replacement.id };
  }

  /** Retiring and inserting the replacement commit together, so no moment exists in which the user holds no active key. */
  async #retireAndReplace(userId: string, active: DataKeyOutput): Promise<{ retired: DataKeyOutput; replacement: DataKeyOutput }> {
    const wrapped = await wrapDataKey(await this.sealingKeyService.getSealingKey());

    return await this.txService.transaction(async () => {
      const retired = await this.dataKeyRepository.retireIfActive(active.id);

      if (!retired) {
        this.logger.error({ event: "DATA_KEY_REKEY_KEY_MOVED_BY_ANOTHER_WRITER", userId, dataKeyId: active.id });

        throw new Error(`Data key ${active.id} was retired or replaced by another writer`);
      }

      const replacement = await this.dataKeyRepository.create({ userId, ...wrapped });
      this.logger.info({ event: "DATA_KEY_REKEY_KEY_RETIRED", userId, retiredDataKeyId: retired.id, activeDataKeyId: replacement.id });

      return { retired, replacement };
    });
  }

  async #resealEveryDeployment(userId: string, keys: RekeyKeys, pageSize: number, dryRun: boolean): Promise<ResealPass> {
    const pass: ResealPass = {
      deploymentsResealed: 0,
      secretsResealed: 0,
      deploymentsAlreadyUnderActiveKey: 0,
      deploymentsMovedByAnotherWriter: 0,
      deploymentsUnderUnknownKey: [],
      errors: []
    };

    for await (const batch of this.deploymentSettingRepository.findStoredSecretsByUserIteratively({ userId, batchSize: pageSize })) {
      for (const row of batch) {
        await this.#resealDeployment(userId, row, keys, pass, dryRun);
      }

      this.logger.info({ event: "DATA_KEY_REKEY_BATCH", userId, ...this.#counts(pass) });
    }

    return pass;
  }

  async #resealDeployment(userId: string, row: DeploymentStoredSecretsOfUser, keys: RekeyKeys, pass: ResealPass, dryRun: boolean) {
    const kid = kidOf(row.sealedSecrets);

    if (kid !== undefined && kid === keys.targetId) {
      pass.deploymentsAlreadyUnderActiveKey += 1;

      return;
    }

    if (kid !== keys.sourceId) {
      pass.deploymentsUnderUnknownKey.push(row.dseq);
      pass.errors.push(new Error(`Deployment ${row.dseq} is sealed under data key ${String(kid)}, which is neither the user's active nor retired key`));
      this.logger.error({ event: "DATA_KEY_REKEY_DEPLOYMENT_UNDER_UNKNOWN_KEY", userId, dseq: row.dseq, kid });

      return;
    }

    try {
      await this.#reseal(userId, row, pass, dryRun);
    } catch (error) {
      pass.errors.push(error);
      this.logger.error({ event: "DATA_KEY_REKEY_DEPLOYMENT_FAILED", userId, dseq: row.dseq, error });
    }
  }

  /** Opened and sealed through the same paths a deployment uses, so the new token carries exactly the owner and deployment claims the old one did. */
  async #reseal(userId: string, row: DeploymentStoredSecretsOfUser, pass: ResealPass, dryRun: boolean) {
    const secrets = await this.sdlSecretsService.openStored({ userId, dseq: row.dseq, sealedSecrets: row.sealedSecrets });

    if (dryRun || (await this.#writeResealed(userId, row, secrets))) {
      pass.deploymentsResealed += 1;
      pass.secretsResealed += Object.keys(secrets).length;

      return;
    }

    pass.deploymentsMovedByAnotherWriter += 1;
    this.logger.warn({ event: "DATA_KEY_REKEY_DEPLOYMENT_MOVED_BY_ANOTHER_WRITER", userId, dseq: row.dseq });
  }

  async #writeResealed(userId: string, row: DeploymentStoredSecretsOfUser, secrets: SdlSecrets): Promise<boolean> {
    const resealed = await this.sdlSecretsService.sealForStorage({ userId, dseq: row.dseq, secrets });

    return await this.deploymentSettingRepository.resealIfUnchanged(row.id, row.sealedSecrets, resealed);
  }

  /** The retired key goes only once a fresh scan finds nothing sealed under it and it has been retired long enough for any straggling write to have landed. */
  async #settleRetiredKey(
    userId: string,
    retired: DataKeyOutput | undefined,
    pass: ResealPass,
    pageSize: number,
    dryRun: boolean
  ): Promise<{ deleted: boolean; deletableAfter: Date | null }> {
    if (!retired || !retired.retiredAt) {
      return { deleted: false, deletableAfter: null };
    }

    const deletableAfter = new Date(retired.retiredAt.getTime() + MIN_RETIREMENT_AGE_BEFORE_DELETE_MS);

    if (dryRun) {
      return { deleted: false, deletableAfter };
    }

    const keptBecause = await this.#reasonToKeep(userId, retired, pass, pageSize, deletableAfter);

    if (keptBecause) {
      this.logger.warn({ event: "DATA_KEY_REKEY_RETIRED_KEY_KEPT", userId, retiredDataKeyId: retired.id, reason: keptBecause, deletableAfter });

      return { deleted: false, deletableAfter };
    }

    const deleted = await this.dataKeyRepository.deleteRetired(retired.id);
    this.logger.info({ event: "DATA_KEY_REKEY_RETIRED_KEY_DELETED", userId, retiredDataKeyId: retired.id, deleted });

    return { deleted, deletableAfter };
  }

  async #reasonToKeep(userId: string, retired: DataKeyOutput, pass: ResealPass, pageSize: number, deletableAfter: Date): Promise<string | undefined> {
    if (pass.errors.length > 0) return "a deployment could not be re-sealed";
    if (pass.deploymentsMovedByAnotherWriter > 0) return "a deployment was rewritten during the pass";
    if (Date.now() < deletableAfter.getTime()) return "the key was retired less than a minute ago";

    const stillSealedUnderIt = await this.#countSealedUnder(userId, retired.id, pageSize);

    return stillSealedUnderIt > 0 ? `${stillSealedUnderIt} deployments are still sealed under it` : undefined;
  }

  async #countSealedUnder(userId: string, dataKeyId: string, pageSize: number): Promise<number> {
    let count = 0;

    for await (const batch of this.deploymentSettingRepository.findStoredSecretsByUserIteratively({ userId, batchSize: pageSize })) {
      count += batch.filter(row => kidOf(row.sealedSecrets) === dataKeyId).length;
    }

    return count;
  }

  #counts(pass: ResealPass) {
    return {
      resealed: pass.deploymentsResealed,
      alreadyUnderActiveKey: pass.deploymentsAlreadyUnderActiveKey,
      movedByAnotherWriter: pass.deploymentsMovedByAnotherWriter,
      underUnknownKey: pass.deploymentsUnderUnknownKey.length,
      failed: pass.errors.length
    };
  }
}
