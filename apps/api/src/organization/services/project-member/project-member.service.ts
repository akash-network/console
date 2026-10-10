import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { TxService } from "@src/core/services/tx/tx.service";
import type { ProjectRole } from "@src/organization/model-schemas/project-member/project-member.schema";
import {
  type OrganizationMemberOutput,
  OrganizationMemberRepository
} from "@src/organization/repositories/organization-member/organization-member.repository";
import { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import { ProjectMemberRepository, type ProjectMemberWithUser } from "@src/organization/repositories/project-member/project-member.repository";
import { OrganizationActivityService } from "@src/organization/services/organization-activity/organization-activity.service";

export const IMPLICIT_PROJECT_ACCESS_ERROR_CODE = "implicit_project_access";
export const BILLING_ROLE_NOT_GRANTABLE_ERROR_CODE = "billing_role_not_grantable";
export const ALREADY_GRANTED_ERROR_CODE = "already_granted";

export interface ProjectGrant {
  projectId: string;
  userId: string;
  role: ProjectRole;
}

@singleton()
export class ProjectMemberService {
  constructor(
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly organizationActivityService: OrganizationActivityService,
    private readonly authService: AuthService,
    private readonly txService: TxService
  ) {}

  async list(projectId: string): Promise<ProjectMemberWithUser[]> {
    const project = await this.projectRepository.accessibleBy(this.authService.ability, "read").findOneBy({ id: projectId, deletedAt: null });
    assertProjectFound(project);

    return await this.projectMemberRepository.accessibleBy(this.authService.ability, "read").findOfLiveProjects({ projectId });
  }

  async create({ projectId, userId, role }: ProjectGrant): Promise<ProjectMemberWithUser> {
    const ability = this.authService.ability;

    return await this.txService.transaction(async () => {
      const project = await this.projectRepository.accessibleBy(ability, "read").findActiveAndLock(projectId);
      assertProjectFound(project);
      const { organizationId } = project;
      assertGrantable(await this.organizationMemberRepository.findOneByAndLock({ organizationId, userId }));

      const repository = this.projectMemberRepository.accessibleBy(ability, "create");
      const created = await repository.createUnlessExists({ organizationId, projectId, userId, role });

      if (!created) {
        throw createError(409, "This member already has access to the project", { errorCode: ALREADY_GRANTED_ERROR_CODE });
      }

      const [grant] = await repository.findOfLiveProjects({ id: created.id });
      await this.organizationActivityService.record({
        organizationId,
        type: "member_granted",
        actorUserId: this.authService.currentUser.id,
        projectId,
        payload: { userId, username: grant.username, role }
      });

      return grant;
    });
  }

  async update(id: string, { role }: Pick<ProjectGrant, "role">): Promise<ProjectMemberWithUser> {
    const repository = this.projectMemberRepository.accessibleBy(this.authService.ability, "update");
    const [grant] = await repository.findOfLiveProjects({ id });
    assertGrantFound(grant);
    assertGrantFound(await repository.updateBy({ id }, { role }, { returning: true }));

    return { ...grant, role };
  }

  async delete(id: string): Promise<void> {
    const repository = this.projectMemberRepository.accessibleBy(this.authService.ability, "delete");

    await this.txService.transaction(async () => {
      const [grant] = await repository.findOfLiveProjects({ id });
      assertGrantFound(grant);
      assertGrantFound(await repository.deleteBy({ id }, { returning: true }));

      await this.organizationActivityService.record({
        organizationId: grant.organizationId,
        type: "member_revoked",
        actorUserId: this.authService.currentUser.id,
        projectId: grant.projectId,
        payload: { userId: grant.userId, username: grant.username }
      });
    });
  }
}

function assertProjectFound<T>(project: T | undefined): asserts project is T {
  if (!project) {
    throw createError(404, "Project not found");
  }
}

function assertGrantFound<T>(grant: T | undefined): asserts grant is T {
  if (!grant) {
    throw createError(404, "Project member not found");
  }
}

function assertGrantable(member: OrganizationMemberOutput | undefined): void {
  if (!member) {
    throw createError(404, "Organization member not found");
  }

  if (member.role === "owner" || member.role === "admin") {
    throw createError(409, "Owners and admins already reach every project", { errorCode: IMPLICIT_PROJECT_ACCESS_ERROR_CODE });
  }

  if (member.role === "billing") {
    throw createError(409, "Billing members have no project access to grant", { errorCode: BILLING_ROLE_NOT_GRANTABLE_ERROR_CODE });
  }
}
