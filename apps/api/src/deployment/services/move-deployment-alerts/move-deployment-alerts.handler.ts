import { inject, singleton } from "tsyringe";

import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { MoveDeploymentAlertsJob } from "./move-deployment-alerts.job";

@singleton()
export class MoveDeploymentAlertsHandler implements JobHandler<MoveDeploymentAlertsJob> {
  public readonly accepts = MoveDeploymentAlertsJob;

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly notificationService: NotificationService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: MoveDeploymentAlertsHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  /** Reads the project when it runs rather than when it was queued, so moves in quick succession settle on the last one whatever order their jobs run in. */
  async handle({ organizationId, dseq }: JobPayload<MoveDeploymentAlertsJob>): Promise<void> {
    const filing = await this.deploymentSettingRepository.findFilingInOrganization(organizationId, dseq);

    if (!filing?.projectId || !filing.ownerAddress) {
      this.logger.warn({ event: "DEPLOYMENT_ALERTS_MOVE_SKIPPED", organizationId, dseq, filing, reason: "The deployment has no project or no owner wallet" });
      return;
    }

    const { projectId, ownerAddress: owner } = filing;
    await this.notificationService.moveDeploymentAlertsToProject({ organizationId, deployment: { owner, dseq }, projectId });
    this.logger.info({ event: "DEPLOYMENT_ALERTS_MOVED", organizationId, owner, dseq, projectId });
  }
}
