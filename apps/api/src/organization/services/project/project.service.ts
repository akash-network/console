import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { isUniqueViolation } from "@src/core/repositories/base.repository";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { toSlug } from "@src/organization/lib/slug/slug";
import { type ProjectInput, ProjectRepository, type ProjectWithCreator } from "@src/organization/repositories/project/project.repository";
import { OrganizationActivityService } from "@src/organization/services/organization-activity/organization-activity.service";

export interface ProjectChanges {
  name?: string;
  description?: string | null;
}

@singleton()
export class ProjectService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly organizationActivityService: OrganizationActivityService,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    private readonly txService: TxService
  ) {}

  async list(): Promise<ProjectWithCreator[]> {
    return await this.projectRepository.accessibleBy(this.authService.ability, "read").findActiveWithCreator();
  }

  async get(id: string): Promise<ProjectWithCreator> {
    const [project] = await this.projectRepository.accessibleBy(this.authService.ability, "read").findActiveWithCreator({ id });

    if (!project) {
      throw createError(404, "Project not found");
    }

    return project;
  }

  async create(input: { name: string; description?: string | null }): Promise<ProjectWithCreator> {
    const { id: userId, username } = this.authService.currentUser;
    const organizationId = this.#activeOrganizationId();
    const repository = this.projectRepository.accessibleBy(this.authService.ability, "create");

    const project = await this.txService.transaction(async () => {
      const created = await rejectTakenName(() =>
        repository.create({
          organizationId,
          name: input.name,
          slug: toSlug(input.name),
          description: input.description || null,
          createdByUserId: userId
        })
      );
      await this.organizationActivityService.record({
        organizationId,
        type: "project_created",
        actorUserId: userId,
        projectId: created.id,
        payload: { projectName: created.name }
      });

      return created;
    });

    return { ...project, createdBy: { id: userId, username: username ?? null } };
  }

  async update(id: string, changes: ProjectChanges): Promise<ProjectWithCreator> {
    const repository = this.projectRepository.accessibleBy(this.authService.ability, "update");
    const updated = await rejectTakenName(() => repository.updateBy({ id, deletedAt: null }, toChangedFields(changes), { returning: true }));

    if (!updated) {
      throw createError(404, "Project not found");
    }

    return await this.get(id);
  }

  async delete(id: string): Promise<void> {
    const repository = this.projectRepository.accessibleBy(this.authService.ability, "delete");

    await this.txService.transaction(async () => {
      const project = await repository.findOneByAndLock({ id, deletedAt: null });

      if (!project) {
        throw createError(404, "Project not found");
      }

      if (project.isDefault) {
        throw createError(409, "The default project cannot be deleted", { errorCode: "project_is_default" });
      }

      const openDeployments = await this.deploymentSettingRepository.count({ projectId: id, closed: false });

      if (openDeployments > 0) {
        throw createError(409, "Move or close the project's deployments before deleting it", { errorCode: "project_not_empty" });
      }

      await repository.updateById(id, { deletedAt: new Date() });
    });
  }

  #activeOrganizationId(): string {
    const context = this.executionContextService.get("ORGANIZATION_CONTEXT");

    if (!context) {
      throw createError(403, "Projects belong to an organization and this request runs in none");
    }

    return context.organizationId;
  }
}

function toChangedFields({ name, description }: ProjectChanges): Partial<ProjectInput> {
  return {
    ...(name !== undefined && { name, slug: toSlug(name) }),
    ...(description !== undefined && { description: description || null })
  };
}

async function rejectTakenName<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw createError(409, "A project with this name already exists", { errorCode: "project_name_taken" });
    }

    throw error;
  }
}
