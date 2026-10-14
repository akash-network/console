import { inject, singleton } from "tsyringe";

import { centsToUsd } from "@src/billing/lib/currency/currency";
import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { projectBudgetAlertNotification } from "@src/notifications/services/notification-templates/project-budget-alert-notification";
import { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import { ProjectBudgetRepository } from "@src/organization/repositories/project-budget/project-budget.repository";
import { UserRepository } from "@src/user/repositories";

/** One owner's or admin's copy of a project's budget alert, queued in the transaction that marked the alert sent for the month. */
export class ProjectBudgetAlert implements Job {
  static readonly [JOB_NAME] = "ProjectBudgetAlert";
  readonly name = ProjectBudgetAlert[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      userId: string;
      organizationId: string;
      projectId: string;
      period: string;
      committedCents: number;
      refusedCents: number;
    }
  ) {}
}

@singleton()
export class ProjectBudgetAlertHandler implements JobHandler<ProjectBudgetAlert> {
  public readonly accepts = ProjectBudgetAlert;

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly projectBudgetRepository: ProjectBudgetRepository,
    private readonly notificationService: NotificationService,
    private readonly deploymentConfig: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: ProjectBudgetAlertHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ userId, organizationId, projectId, period, committedCents, refusedCents }: JobPayload<ProjectBudgetAlert>): Promise<void> {
    const [user, project, budget] = await Promise.all([
      this.userRepository.findById(userId),
      this.projectRepository.findOneBy({ id: projectId, organizationId }),
      this.projectBudgetRepository.findOneBy({ organizationId, projectId })
    ]);

    if (!user?.email || !project || !budget) {
      this.logger.warn({ event: "PROJECT_BUDGET_ALERT_SKIPPED", userId, projectId, hasEmail: !!user?.email, hasProject: !!project, hasBudget: !!budget });
      return;
    }

    await this.notificationService.createNotification(
      projectBudgetAlertNotification(user, {
        projectId,
        projectName: project.name,
        period,
        committedUsd: centsToUsd(committedCents),
        budgetUsd: centsToUsd(budget.monthlyAmountCents),
        refusedUsd: centsToUsd(refusedCents),
        stopTopUps: budget.stopTopUps,
        projectUrl: `${this.deploymentConfig.get("DEPLOY_WEB_BASE_URL")}/projects/${encodeURIComponent(projectId)}?org=${encodeURIComponent(organizationId)}`
      })
    );

    this.logger.info({ event: "PROJECT_BUDGET_ALERT_SENT", userId, organizationId, projectId, period });
  }
}
