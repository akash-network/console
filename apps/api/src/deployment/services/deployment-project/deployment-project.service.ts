import { subject } from "@casl/ability";
import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { TxService } from "@src/core/services/tx/tx.service";
import {
  type DeploymentLocation,
  type DeploymentReach,
  DeploymentSettingRepository,
  type DeploymentSettingsOutput
} from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { type ProjectOutput, ProjectRepository } from "@src/organization/repositories/project/project.repository";
import { OrganizationActivityService } from "@src/organization/services/organization-activity/organization-activity.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";

export const PROJECT_REQUIRED_ERROR_CODE = "project_required";

const ROLES_MOVING_DEPLOYMENTS: readonly OrganizationRole[] = ["owner", "admin"];

@singleton()
export class DeploymentProjectService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly organizationActivityService: OrganizationActivityService,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    private readonly txService: TxService
  ) {}

  /** Undefined outside organization mode, where the requested project is ignored and the deployment is filed the way every other write is. */
  async resolveFilingProject(requestedProjectId?: string): Promise<string | undefined> {
    const context = this.#organizationModeContext();

    if (!context) return undefined;

    if (requestedProjectId) {
      const project = await this.projectRepository.findOneBy({ id: requestedProjectId, deletedAt: null });

      if (!project || !this.#canFileInto(context, project.id)) {
        throw createError(404, "Project not found");
      }

      return project.id;
    }

    const soleProjectId = soleProjectInScope(context);
    const fallback = await this.projectRepository.findOneBy(soleProjectId ? { id: soleProjectId, deletedAt: null } : { isDefault: true, deletedAt: null });

    if (!fallback || !this.#canFileInto(context, fallback.id)) {
      throw createError(400, "Choose a project to deploy into", { errorCode: PROJECT_REQUIRED_ERROR_CODE });
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

      if (!target || !this.#canFileInto(context, target.id)) {
        throw createError(404, "Project not found");
      }

      if (deployment.projectId === target.id) return;

      await repository.updateById(deployment.id, { projectId: target.id });
      await this.#recordMoved(context, deployment, target);
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

  #canFileInto(context: OrganizationContext, projectId: string): boolean {
    return this.authService.ability.can("create", subject("DeploymentSetting", { organizationId: context.organizationId, projectId }));
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

/** A caller held to one project, a project-bound API key or a narrowing header for instance, deploys there rather than into a default project it cannot reach. */
function soleProjectInScope({ projectScope }: OrganizationContext): string | undefined {
  return projectScope.kind === "projects" && projectScope.projectIds.length === 1 ? projectScope.projectIds[0] : undefined;
}
