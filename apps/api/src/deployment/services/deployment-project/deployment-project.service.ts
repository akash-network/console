import { subject } from "@casl/ability";
import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { TxService } from "@src/core/services/tx/tx.service";
import {
  type DeploymentLocation,
  type DeploymentReach,
  DeploymentSettingRepository,
  type DeploymentSettingsOutput
} from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { MOVE_DEPLOYMENT_ALERTS_RETRY_OPTIONS, MoveDeploymentAlertsJob } from "@src/deployment/services/move-deployment-alerts/move-deployment-alerts.job";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { type ProjectOutput, ProjectRepository } from "@src/organization/repositories/project/project.repository";
import { OrganizationActivityService } from "@src/organization/services/organization-activity/organization-activity.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";

export const PROJECT_REQUIRED_ERROR_CODE = "project_required";

type ProjectFiledSubject = "DeploymentSetting" | "Template";

const PROJECT_REQUIRED_MESSAGES: Record<ProjectFiledSubject, string> = {
  DeploymentSetting: "Choose a project to deploy into",
  Template: "Choose a project to save the template in"
};

const ROLES_MOVING_DEPLOYMENTS: readonly OrganizationRole[] = ["owner", "admin"];

@singleton()
export class DeploymentProjectService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly organizationActivityService: OrganizationActivityService,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    private readonly txService: TxService,
    private readonly jobQueueService: JobQueueService
  ) {}

  /** Undefined outside organization mode, where the requested project is ignored and the row is filed the way every other write is. */
  async resolveFilingProject(requestedProjectId?: string, subjectType: ProjectFiledSubject = "DeploymentSetting"): Promise<string | undefined> {
    const context = this.#organizationModeContext();

    if (!context) return undefined;

    if (requestedProjectId) {
      const project = await this.projectRepository.findOneBy({ id: requestedProjectId, deletedAt: null });

      if (!project || !this.#canFileInto(context, project.id, subjectType)) {
        throw createError(404, "Project not found");
      }

      return project.id;
    }

    const soleProjectId = soleWritableProjectInScope(context);
    const fallback = await this.projectRepository.findOneBy(soleProjectId ? { id: soleProjectId, deletedAt: null } : { isDefault: true, deletedAt: null });

    if (!fallback || !this.#canFileInto(context, fallback.id, subjectType)) {
      throw createError(400, PROJECT_REQUIRED_MESSAGES[subjectType], { errorCode: PROJECT_REQUIRED_ERROR_CODE });
    }

    return fallback.id;
  }

  /** Must run inside the transaction that files the deployment, which then holds the project until it commits. */
  async holdFilingProject(projectId: string): Promise<void> {
    if (!(await this.projectRepository.findActiveAndLock(projectId))) {
      throw createError(404, "Project not found");
    }
  }

  async move(dseq: string, projectId: string): Promise<{ dseq: string; projectId: string }> {
    const context = this.#requireOrganizationContext();

    if (!ROLES_MOVING_DEPLOYMENTS.includes(context.role)) {
      throw createError(403, "Only owners and admins can move deployments between projects");
    }

    const repository = this.deploymentSettingRepository.accessibleBy(this.authService.ability, "update");

    await this.txService.transaction(async () => {
      const deployment = await this.#findMovable(repository, dseq);
      const target = await this.projectRepository.findActiveAndLock(projectId);

      if (!target || !this.#canFileInto(context, target.id, "DeploymentSetting")) {
        throw createError(404, "Project not found");
      }

      if (deployment.projectId === target.id) return;

      await repository.updateById(deployment.id, { projectId: target.id });
      await this.#recordMoved(context, deployment, target);
      await this.jobQueueService.enqueue(
        new MoveDeploymentAlertsJob({ organizationId: context.organizationId, dseq: deployment.dseq }),
        MOVE_DEPLOYMENT_ALERTS_RETRY_OPTIONS
      );
    });

    return { dseq, projectId };
  }

  /** Only a signed-in session with no narrowing header looks across organizations; an API key or a narrowed request answers for its own reach alone. */
  async findLocation(dseq: string, { acrossOrganizations }: { acrossOrganizations: boolean }): Promise<DeploymentLocation> {
    const location = await this.deploymentSettingRepository.findLocation({
      userId: this.authService.currentUser.id,
      dseq,
      within: acrossOrganizations ? undefined : this.#activeReach()
    });

    if (!location) {
      throw createError(404, "Deployment not found");
    }

    return location;
  }

  async #findMovable(repository: DeploymentSettingRepository, dseq: string): Promise<DeploymentSettingsOutput> {
    const deployments = await repository.find({ dseq });
    const deployment = deployments.find(({ userId }) => userId === this.authService.currentUser.id) ?? deployments[0];

    if (!deployment) {
      throw createError(404, "Deployment not found");
    }

    return deployment;
  }

  async #recordMoved(context: OrganizationContext, deployment: DeploymentSettingsOutput, target: ProjectOutput): Promise<void> {
    await this.organizationActivityService.record({
      organizationId: context.organizationId,
      projectId: target.id,
      type: "deployment_moved",
      actorUserId: this.authService.currentUser.id,
      payload: { dseq: deployment.dseq, name: deployment.name, toProjectName: target.name }
    });
  }

  #canFileInto(context: OrganizationContext, projectId: string, subjectType: ProjectFiledSubject): boolean {
    return this.authService.ability.can("create", subject(subjectType, { organizationId: context.organizationId, projectId }));
  }

  #activeReach(): DeploymentReach {
    const { organizationId, projectScope } = this.#requireOrganizationContext();

    return { organizationId, projectIds: projectScope.kind === "projects" ? projectScope.projectIds : undefined };
  }

  #organizationModeContext(): OrganizationContext | undefined {
    const context = this.executionContextService.hasContext() ? this.executionContextService.get("ORGANIZATION_CONTEXT") : undefined;

    return context?.mode === "organization" ? context : undefined;
  }

  #requireOrganizationContext(): OrganizationContext {
    const context = this.#organizationModeContext();

    if (!context) {
      throw createError(403, "Deployments are filed into projects of an organization and this request runs in none");
    }

    return context;
  }
}

/** A caller who may write to one project only, through a project-bound API key, a narrowing header or its grants, deploys there rather than into a default project. */
function soleWritableProjectInScope({ projectScope }: OrganizationContext): string | undefined {
  return projectScope.kind === "projects" && projectScope.writableProjectIds.length === 1 ? projectScope.writableProjectIds[0] : undefined;
}
