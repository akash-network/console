import { inject, singleton } from "tsyringe";

import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, LOGGER_FACTORY } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentPresenceService } from "@src/deployment/services/deployment-presence/deployment-presence.service";

/**
 * Compensates a deployment setting whose create transaction may never have reached the chain. Written in the
 * same transaction as the row itself and cancelled the moment the broadcast succeeds, so it only ever runs for
 * a create that failed, or crashed between broadcasting and cancelling.
 */
export class DeleteUnbackedDeploymentSetting implements Job {
  static readonly [JOB_NAME] = "DeleteUnbackedDeploymentSetting";
  readonly name = DeleteUnbackedDeploymentSetting[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      deploymentSettingId: string;
      owner: string;
      dseq: string;
    }
  ) {}
}

/**
 * Derives the compensation's key from the row's natural key, so the create that enqueued it can cancel it
 * after a successful broadcast without carrying a job id through the signing round trip.
 */
export function unbackedDeploymentSettingKeyFor({ userId, dseq }: { userId: string; dseq: string }): string {
  return `deleteUnbackedDeploymentSetting.${userId}.${dseq}`;
}

@singleton()
export class DeleteUnbackedDeploymentSettingHandler implements JobHandler<DeleteUnbackedDeploymentSetting> {
  public readonly accepts = DeleteUnbackedDeploymentSetting;

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly deploymentPresenceService: DeploymentPresenceService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: DeleteUnbackedDeploymentSettingHandler.name });
  }

  /**
   * Running is not evidence that the deployment is missing — the broadcast may have landed and the process died
   * before cancelling, and `cancelCreatedBy` only cancels a job still waiting, so a compensation a
   * worker has already picked up cannot be called off at all. What keeps a live deployment's row safe in that
   * window is not the cancellation but the two things below, and anything short of a chain answer escapes,
   * because the queue retrying costs a row's extra lifetime while a wrong delete costs the only stored copy of
   * its SDL and its runtime limit.
   *
   * The row's own `createdAt` is what the chain answer is judged against, which is why it is read here rather
   * than taken from the payload: the guard has to be anchored to when the record was actually written.
   *
   * The repository is used unscoped on purpose. Job execution runs under an empty ability, and `accessibleBy`
   * builds a `DrizzleAbility` that refuses in a field initializer, so a scoped read would throw before any SQL ran.
   */
  async handle(payload: JobPayload<DeleteUnbackedDeploymentSetting>): Promise<void> {
    const { deploymentSettingId, owner, dseq } = payload;
    const setting = await this.deploymentSettingRepository.findById(deploymentSettingId);

    if (!setting) {
      this.logger.info({ event: "UNBACKED_DEPLOYMENT_SETTING_ALREADY_GONE", deploymentSettingId, owner, dseq });
      return;
    }

    if (setting.dseq !== dseq) {
      this.logger.error({ event: "UNBACKED_DEPLOYMENT_SETTING_DSEQ_MISMATCH", deploymentSettingId, owner, dseq, storedDseq: setting.dseq });
      return;
    }

    if (!setting.createdAt) {
      this.logger.error({ event: "UNBACKED_DEPLOYMENT_SETTING_UNDATED", deploymentSettingId, owner, dseq });
      return;
    }

    if (await this.isOnChain({ deploymentSettingId, owner, dseq, recordedAt: new Date(setting.createdAt) })) {
      this.logger.info({ event: "UNBACKED_DEPLOYMENT_SETTING_IS_BACKED", deploymentSettingId, owner, dseq });
      return;
    }

    await this.deploymentSettingRepository.deleteById(deploymentSettingId);
    this.logger.info({ event: "UNBACKED_DEPLOYMENT_SETTING_DELETED", deploymentSettingId, owner, dseq });
  }

  private async isOnChain({
    deploymentSettingId,
    owner,
    dseq,
    recordedAt
  }: {
    deploymentSettingId: string;
    owner: string;
    dseq: string;
    recordedAt: Date;
  }): Promise<boolean> {
    try {
      return await this.deploymentPresenceService.isOnChain({ owner, dseq, recordedAt });
    } catch (error) {
      this.logger.error({ event: "UNBACKED_DEPLOYMENT_SETTING_CHAIN_LOOKUP_FAILED", deploymentSettingId, owner, dseq, error });
      throw error;
    }
  }
}
