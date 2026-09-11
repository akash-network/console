import { inject, singleton } from "tsyringe";

import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";

/** Records a deployment created through the transaction endpoint, which bypasses the deployment API and so leaves the funding sweep with no row to find. */
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

  /** One record per deployment across queued, retrying and running, so a retried broadcast of the same create enqueues nothing new; pg-boss's `singleton` only caps the running ones. */
  public readonly policy = "exclusive";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: RecordDeploymentSettingHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  /** Unscoped because job execution runs under an empty ability, which a scoped read would throw on before any SQL ran. */
  async handle(payload: JobPayload<RecordDeploymentSetting>): Promise<void> {
    const created = await this.deploymentSettingRepository.createDefaultIfMissing(payload);

    this.logger.info({ event: created ? "DEPLOYMENT_SETTING_RECORDED" : "DEPLOYMENT_SETTING_ALREADY_RECORDED", userId: payload.userId, dseq: payload.dseq });
  }
}
