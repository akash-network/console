import { subject } from "@casl/ability";
import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { getPostgresError } from "@src/core/repositories/base.repository";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { closureKey, normalizeDseq } from "@src/deployment/lib/deployment-closure-key/deployment-closure-key";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import {
  type ProjectDeploymentSummary,
  ProjectDeploymentSummaryService
} from "@src/deployment/services/project-deployment-summary/project-deployment-summary.service";
import { slugCandidates } from "@src/organization/lib/slug/slug";
import { PROJECT_NAME_UNIQUE_INDEX } from "@src/organization/model-schemas/project/project.schema";
import { ORGANIZATION_CONFIG, type OrganizationConfig } from "@src/organization/providers/config.provider";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import {
  type ProjectInput,
  type ProjectOutput,
  ProjectRepository,
  type ProjectWithCreator,
  type ProjectWithLastActivity
} from "@src/organization/repositories/project/project.repository";
import { OrganizationActivityService } from "@src/organization/services/organization-activity/organization-activity.service";

export interface ProjectChanges {
  name?: string;
  description?: string | null;
}

export const PROJECT_LIMIT_REACHED_ERROR_CODE = "project_limit_reached";

/** `deployments` is null when the caller may not read the project's deployments or too many are open to count. */
export type ListedProject = ProjectWithCreator & {
  lastActivityAt: Date;
  deployments: ProjectDeploymentSummary | null;
  access: { canDeploy: boolean; canManage: boolean };
};

const NO_ACTIVE_DEPLOYMENTS: ProjectDeploymentSummary = { activeCount: 0, preview: [] };

const FALLBACK_PROJECT_SLUG_PREFIX = "project";

@singleton()
export class ProjectService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly projectDeploymentSummaryService: ProjectDeploymentSummaryService,
    private readonly organizationActivityService: OrganizationActivityService,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    private readonly txService: TxService,
    @inject(ORGANIZATION_CONFIG) private readonly config: OrganizationConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: ProjectService.name });
  }

  /** Most recently active first; summaries and activity times only cover what the caller may read in each project. */
  async list(): Promise<ListedProject[]> {
    const { ability } = this.authService;
    const projects = await this.projectRepository.accessibleBy(ability, "read").findActiveWithLastActivity();
    const summaries = projects.length > 0 ? await this.projectDeploymentSummaryService.summarizeByProject(this.#activeOrganizationId()) : undefined;

    return projects.map(project => listedFor(ability, project, summaries)).sort(mostRecentlyActiveFirst);
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
      await this.organizationRepository.findOneByAndLock({ id: organizationId, deletedAt: null }, { strength: "no key update" });

      const created = await rejectTakenName(() =>
        repository.createWithFirstFreeSlug(
          { organizationId, name: input.name, description: input.description || null, createdByUserId: userId },
          slugCandidates(input.name, FALLBACK_PROJECT_SLUG_PREFIX)
        )
      );

      if (!created) {
        throw new Error("Every slug candidate for the project is taken");
      }

      await this.#refuseOverProjectLimit(organizationId);

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
    const project = assertDeletable(await repository.findOneBy({ id, deletedAt: null }));
    const projectKey = { organizationId: project.organizationId, projectId: project.id };
    await this.#closeDeploymentsEndedOnChain(projectKey);

    await this.txService.transaction(async () => {
      assertDeletable(await repository.findOneByAndLock({ id, deletedAt: null }));

      if ((await this.deploymentSettingRepository.count({ ...projectKey, closed: false })) > 0) {
        throw createError(409, "Move or close the project's deployments before deleting it", { errorCode: "project_not_empty" });
      }

      await repository.updateById(id, { deletedAt: new Date() });
    });
  }

  /** The closed flag only catches up with deployments closed outside the console on the next reconcile, so the chain decides what still counts as open. */
  async #closeDeploymentsEndedOnChain(projectKey: { organizationId: string; projectId: string }): Promise<void> {
    const deployments = await this.deploymentSettingRepository.findOpenInProject(projectKey);
    const closureStates = await this.deploymentRepository.findClosureStates(
      deployments.map(({ address, dseq }) => ({ owner: address, dseq: normalizeDseq(dseq) }))
    );
    const closedOnChain = new Set(closureStates.filter(({ isClosed }) => isClosed).map(closureKey));

    await this.deploymentSettingRepository.markAsClosedInProject(
      projectKey,
      deployments.filter(({ address, dseq }) => closedOnChain.has(closureKey({ owner: address, dseq }))).map(({ id }) => id)
    );
  }

  /** Counts after the insert, so a caller who may not create projects is refused for that first; the organization lock makes parallel creations count one at a time. */
  async #refuseOverProjectLimit(organizationId: string): Promise<void> {
    const limit = this.config.PROJECTS_PER_ORGANIZATION_LIMIT;
    if ((await this.projectRepository.count({ organizationId, deletedAt: null })) <= limit) return;

    this.#logger.info({ event: "PROJECT_LIMIT_REACHED", organizationId, limit });
    throw createError(403, "The organization has reached the number of projects it can have", {
      errorCode: PROJECT_LIMIT_REACHED_ERROR_CODE,
      data: { limit }
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

/** Each project's own fields are checked against the ability, so a caller listing a project it cannot open learns nothing of what runs in it. */
function listedFor(
  ability: AuthService["ability"],
  project: ProjectWithLastActivity,
  summaries: Map<string, ProjectDeploymentSummary> | undefined
): ListedProject {
  const inProject = { organizationId: project.organizationId, projectId: project.id };
  const readsActivity = ability.can("read", subject("OrganizationActivity", { ...inProject }));
  const readsDeployments = ability.can("read", subject("DeploymentSetting", { ...inProject }));

  return {
    ...project,
    lastActivityAt: readsActivity && project.lastActivityAt && project.lastActivityAt > project.createdAt ? project.lastActivityAt : project.createdAt,
    deployments: readsDeployments && summaries ? summaries.get(project.id) ?? NO_ACTIVE_DEPLOYMENTS : null,
    access: {
      canDeploy: ability.can("create", subject("DeploymentSetting", { ...inProject })),
      canManage: ability.can("update", subject("Project", { organizationId: project.organizationId, id: project.id }))
    }
  };
}

function mostRecentlyActiveFirst(a: ListedProject, b: ListedProject): number {
  return b.lastActivityAt.getTime() - a.lastActivityAt.getTime() || b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id);
}

function assertDeletable(project: ProjectOutput | undefined): ProjectOutput {
  if (!project) {
    throw createError(404, "Project not found");
  }

  if (project.isDefault) {
    throw createError(409, "The default project cannot be deleted", { errorCode: "project_is_default" });
  }

  return project;
}

function toChangedFields({ name, description }: ProjectChanges): Partial<ProjectInput> {
  return {
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description: description || null })
  };
}

async function rejectTakenName<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (getPostgresError(error)?.constraint_name === PROJECT_NAME_UNIQUE_INDEX) {
      throw createError(409, "A project with this name already exists", { errorCode: "project_name_taken" });
    }

    throw error;
  }
}
