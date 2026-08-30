import { inject, singleton } from "tsyringe";

import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, LOGGER_FACTORY } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";

/**
 * Records a deployment created by broadcasting `MsgCreateDeployment` through the transaction endpoint, which
 * bypasses the deployment API and so writes no settings row of its own; without one the funding sweep, which
 * works from those rows, never sees the deployment.
 */
export class RecordDeploymentSetting implements Job {
  static readonly [JOB_NAME] = "RecordDeploymentSetting";
  readonly name = RecordDeploymentSetting[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      userId: string;
      dseq: string;
    }
  ) {}
}

/** Keyed by the row's natural key so a retried broadcast of the same deployment enqueues one job, not two. */
export function recordDeploymentSettingKeyFor({ userId, dseq }: { userId: string; dseq: string }): string {
  return `recordDeploymentSetting.${userId}.${dseq}`;
}

@singleton()
export class RecordDeploymentSettingHandler implements JobHandler<RecordDeploymentSetting> {
  public readonly accepts = RecordDeploymentSetting;

  /** Gives the command's per-deployment singletonKey its meaning: without it the key is inert and a retried broadcast queues a second job. */
  public readonly policy = "singleton";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: RecordDeploymentSettingHandler.name });
  }

  /**
   * The repository is used unscoped because job execution runs under an empty ability, and it needs no chain
   * check before writing: the job is only ever enqueued after the create transaction has already landed.
   */
  async handle(payload: JobPayload<RecordDeploymentSetting>): Promise<void> {
    const created = await this.deploymentSettingRepository.createDefaultIfMissing(payload);

    this.logger.info({ event: created ? "DEPLOYMENT_SETTING_RECORDED" : "DEPLOYMENT_SETTING_ALREADY_RECORDED", userId: payload.userId, dseq: payload.dseq });
  }
}
