import { Ability, type MongoAbility, type RawRuleOf } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import type { ProjectOutput, ProjectRepository } from "@src/organization/repositories/project/project.repository";
import type { ProjectMemberRepository } from "@src/organization/repositories/project-member/project-member.repository";
import type { OrganizationActivityService } from "@src/organization/services/organization-activity/organization-activity.service";
import {
  ALREADY_GRANTED_ERROR_CODE,
  BILLING_ROLE_NOT_GRANTABLE_ERROR_CODE,
  IMPLICIT_PROJECT_ACCESS_ERROR_CODE,
  ProjectMemberService
} from "./project-member.service";

import { createOrganizationMember, createProject, createProjectMemberWithUser } from "@test/seeders/organization.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(ProjectMemberService.name, () => {
  describe("list", () => {
    it("lists the grants of a live project the caller may read, through the caller's grant rules", async () => {
      const { service, projectRepository, projectMemberRepository, ability, project, grant } = setup();

      const grants = await service.list(project.id);

      expect(grants).toEqual([grant]);
      expect(projectRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(projectRepository.findOneBy).toHaveBeenCalledWith({ id: project.id, deletedAt: null });
      expect(projectMemberRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(projectMemberRepository.findOfLiveProjects).toHaveBeenCalledWith({ projectId: project.id });
    });

    it("answers not found without listing when the caller may read no such project", async () => {
      const { service, projectRepository, projectMemberRepository } = setup();
      projectRepository.findOneBy.mockResolvedValue(undefined);

      await expect(service.list(faker.string.uuid())).rejects.toMatchObject({ status: 404, message: "Project not found" });
      expect(projectMemberRepository.findOfLiveProjects).not.toHaveBeenCalled();
    });

    it("answers not found like a missing project when the project's grants are beyond the caller's reach", async () => {
      const { service, projectMemberRepository, project } = setup({
        grantRules: ({ organizationId }) => [{ action: "manage", subject: "ProjectMember", conditions: { organizationId, projectId: faker.string.uuid() } }]
      });

      await expect(service.list(project.id)).rejects.toMatchObject({ status: 404, message: "Project not found" });
      expect(projectMemberRepository.findOfLiveProjects).not.toHaveBeenCalled();
    });

    it("lists to a caller who may only read the project's grants", async () => {
      const { service, grant, project } = setup({
        grantRules: ({ organizationId, id }) => [{ action: "read", subject: "ProjectMember", conditions: { organizationId, projectId: id } }]
      });

      expect(await service.list(project.id)).toEqual([grant]);
    });
  });

  describe("create", () => {
    it.each(["member", "viewer"] as const)("grants a %s of the project's organization access and records it in the same transaction", async targetRole => {
      const { service, projectRepository, projectMemberRepository, organizationMemberRepository, organizationActivityService, ability, user, project, grant } =
        setup({ targetRole });

      const created = await service.create({ projectId: project.id, userId: grant.userId, role: "viewer" });

      expect(created).toEqual(grant);
      expect(projectRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(projectRepository.findActiveAndLock).toHaveBeenCalledWith(project.id);
      expect(organizationMemberRepository.findOneByAndLock).toHaveBeenCalledWith({ organizationId: project.organizationId, userId: grant.userId });
      expect(projectMemberRepository.accessibleBy).toHaveBeenCalledWith(ability, "create");
      expect(projectMemberRepository.createUnlessExists).toHaveBeenCalledWith({
        organizationId: project.organizationId,
        projectId: project.id,
        userId: grant.userId,
        role: "viewer"
      });
      expect(projectMemberRepository.findOfLiveProjects).toHaveBeenCalledWith({ id: grant.id });
      expect(organizationActivityService.record).toHaveBeenCalledWith({
        organizationId: project.organizationId,
        type: "member_granted",
        actorUserId: user.id,
        projectId: project.id,
        payload: { userId: grant.userId, username: grant.username, role: "viewer" }
      });
    });

    it("runs every read and write inside one transaction", async () => {
      const { service, txService, projectRepository, organizationMemberRepository, projectMemberRepository, organizationActivityService, project, grant } =
        setup();
      const calls: string[] = [];
      txService.transaction.mockImplementation(async callback => {
        calls.push("begin");
        const result = await callback();
        calls.push("commit");
        return result;
      });
      projectRepository.findActiveAndLock.mockImplementation(async () => (calls.push("lock project"), project));
      organizationMemberRepository.findOneByAndLock.mockImplementation(
        async () => (calls.push("lock member"), createOrganizationMember({ organizationId: project.organizationId, userId: grant.userId }))
      );
      projectMemberRepository.createUnlessExists.mockImplementation(async () => (calls.push("insert"), grant));
      organizationActivityService.record.mockImplementation(async () => void calls.push("record"));

      await service.create({ projectId: project.id, userId: grant.userId, role: "member" });

      expect(calls).toEqual(["begin", "lock project", "lock member", "insert", "record", "commit"]);
    });

    it("answers not found when the caller may reach no live project with this id", async () => {
      const { service, projectRepository, organizationMemberRepository, projectMemberRepository } = setup();
      projectRepository.findActiveAndLock.mockResolvedValue(undefined);

      await expect(service.create({ projectId: faker.string.uuid(), userId: faker.string.uuid(), role: "member" })).rejects.toMatchObject({
        status: 404,
        message: "Project not found"
      });
      expect(organizationMemberRepository.findOneByAndLock).not.toHaveBeenCalled();
      expect(projectMemberRepository.createUnlessExists).not.toHaveBeenCalled();
    });

    it("answers not found like a missing project when the caller may only read the project's grants", async () => {
      const { service, organizationMemberRepository, projectMemberRepository, project } = setup({
        grantRules: ({ organizationId, id }) => [{ action: "read", subject: "ProjectMember", conditions: { organizationId, projectId: id } }]
      });

      await expect(service.create({ projectId: project.id, userId: faker.string.uuid(), role: "member" })).rejects.toMatchObject({
        status: 404,
        message: "Project not found"
      });
      expect(organizationMemberRepository.findOneByAndLock).not.toHaveBeenCalled();
      expect(projectMemberRepository.createUnlessExists).not.toHaveBeenCalled();
    });

    it("answers not found like a missing project when the project is outside the request's project scope", async () => {
      const { service, organizationMemberRepository, project } = setup({
        grantRules: ({ organizationId }) => [{ action: "manage", subject: "ProjectMember", conditions: { organizationId, projectId: { $in: [] } } }]
      });

      await expect(service.create({ projectId: project.id, userId: faker.string.uuid(), role: "member" })).rejects.toMatchObject({ status: 404 });
      expect(organizationMemberRepository.findOneByAndLock).not.toHaveBeenCalled();
    });

    it("answers not found when the user is no member of the project's organization", async () => {
      const { service, organizationMemberRepository, projectMemberRepository, organizationActivityService, project } = setup();
      organizationMemberRepository.findOneByAndLock.mockResolvedValue(undefined);

      await expect(service.create({ projectId: project.id, userId: faker.string.uuid(), role: "member" })).rejects.toMatchObject({
        status: 404,
        message: "Organization member not found"
      });
      expect(projectMemberRepository.createUnlessExists).not.toHaveBeenCalled();
      expect(organizationActivityService.record).not.toHaveBeenCalled();
    });

    it.each(["owner", "admin"] as const)("refuses to grant a %s, who already reaches every project", async targetRole => {
      const { service, projectMemberRepository, project, grant } = setup({ targetRole });

      await expect(service.create({ projectId: project.id, userId: grant.userId, role: "member" })).rejects.toMatchObject({
        status: 409,
        errorCode: IMPLICIT_PROJECT_ACCESS_ERROR_CODE,
        message: "Owners and admins already reach every project"
      });
      expect(projectMemberRepository.createUnlessExists).not.toHaveBeenCalled();
    });

    it("refuses to grant a billing member", async () => {
      const { service, projectMemberRepository, project, grant } = setup({ targetRole: "billing" });

      await expect(service.create({ projectId: project.id, userId: grant.userId, role: "member" })).rejects.toMatchObject({
        status: 409,
        errorCode: BILLING_ROLE_NOT_GRANTABLE_ERROR_CODE,
        message: "Billing members have no project access to grant"
      });
      expect(projectMemberRepository.createUnlessExists).not.toHaveBeenCalled();
    });

    it("refuses a grant the user already holds without recording anything", async () => {
      const { service, projectMemberRepository, organizationActivityService, project, grant } = setup();
      projectMemberRepository.createUnlessExists.mockResolvedValue(undefined);

      await expect(service.create({ projectId: project.id, userId: grant.userId, role: "member" })).rejects.toMatchObject({
        status: 409,
        errorCode: ALREADY_GRANTED_ERROR_CODE,
        message: "This member already has access to the project"
      });
      expect(projectMemberRepository.findOfLiveProjects).not.toHaveBeenCalled();
      expect(organizationActivityService.record).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("changes the role of a grant the caller may update", async () => {
      const { service, projectMemberRepository, ability, grant } = setup();

      const updated = await service.update(grant.id, { role: "admin" });

      expect(updated).toEqual({ ...grant, role: "admin" });
      expect(projectMemberRepository.accessibleBy).toHaveBeenCalledWith(ability, "update");
      expect(projectMemberRepository.findOfLiveProjects).toHaveBeenCalledWith({ id: grant.id });
      expect(projectMemberRepository.updateBy).toHaveBeenCalledWith({ id: grant.id }, { role: "admin" }, { returning: true });
    });

    it("answers not found without writing when no grant with this id is within the caller's rules", async () => {
      const { service, projectMemberRepository } = setup();
      projectMemberRepository.findOfLiveProjects.mockResolvedValue([]);

      await expect(service.update(faker.string.uuid(), { role: "admin" })).rejects.toMatchObject({ status: 404, message: "Project member not found" });
      expect(projectMemberRepository.updateBy).not.toHaveBeenCalled();
    });

    it("answers not found when the grant is revoked before the write", async () => {
      const { service, projectMemberRepository, grant } = setup();
      projectMemberRepository.updateBy.mockResolvedValue(undefined);

      await expect(service.update(grant.id, { role: "admin" })).rejects.toMatchObject({ status: 404, message: "Project member not found" });
    });
  });

  describe("delete", () => {
    it("revokes a grant the caller may delete and records it on the grant's project in the same transaction", async () => {
      const { service, projectMemberRepository, organizationActivityService, txService, ability, user, grant } = setup();
      const calls: string[] = [];
      txService.transaction.mockImplementation(async callback => {
        calls.push("begin");
        const result = await callback();
        calls.push("commit");
        return result;
      });
      organizationActivityService.record.mockImplementation(async () => void calls.push("record"));

      await service.delete(grant.id);

      expect(projectMemberRepository.accessibleBy).toHaveBeenCalledWith(ability, "delete");
      expect(projectMemberRepository.findOfLiveProjects).toHaveBeenCalledWith({ id: grant.id });
      expect(projectMemberRepository.deleteBy).toHaveBeenCalledWith({ id: grant.id }, { returning: true });
      expect(organizationActivityService.record).toHaveBeenCalledWith({
        organizationId: grant.organizationId,
        type: "member_revoked",
        actorUserId: user.id,
        projectId: grant.projectId,
        payload: { userId: grant.userId, username: grant.username }
      });
      expect(calls).toEqual(["begin", "record", "commit"]);
      expect(projectMemberRepository.deleteBy.mock.invocationCallOrder[0]).toBeLessThan(organizationActivityService.record.mock.invocationCallOrder[0]);
    });

    it("answers not found without deleting when no grant with this id is within the caller's rules", async () => {
      const { service, projectMemberRepository, organizationActivityService } = setup();
      projectMemberRepository.findOfLiveProjects.mockResolvedValue([]);

      await expect(service.delete(faker.string.uuid())).rejects.toMatchObject({ status: 404, message: "Project member not found" });
      expect(projectMemberRepository.deleteBy).not.toHaveBeenCalled();
      expect(organizationActivityService.record).not.toHaveBeenCalled();
    });

    it("answers not found without recording when a concurrent revoke removed the grant first", async () => {
      const { service, projectMemberRepository, organizationActivityService, grant } = setup();
      projectMemberRepository.deleteBy.mockResolvedValue(undefined);

      await expect(service.delete(grant.id)).rejects.toMatchObject({ status: 404, message: "Project member not found" });
      expect(organizationActivityService.record).not.toHaveBeenCalled();
    });
  });

  function setup(input: { targetRole?: OrganizationRole; grantRules?: (project: ProjectOutput) => RawRuleOf<MongoAbility>[] } = {}) {
    const user = createUser();
    const project = createProject();
    const grantRules = input.grantRules ?? (({ organizationId }) => [{ action: "manage", subject: "ProjectMember", conditions: { organizationId } }]);
    const ability = new Ability(grantRules(project));
    const grant = createProjectMemberWithUser({ organizationId: project.organizationId, projectId: project.id });
    const projectRepository = mock<ProjectRepository>({
      findOneBy: vi.fn().mockResolvedValue(project),
      findActiveAndLock: vi.fn().mockResolvedValue(project)
    });
    projectRepository.accessibleBy.mockReturnValue(projectRepository);
    const projectMemberRepository = mock<ProjectMemberRepository>({
      findOfLiveProjects: vi.fn().mockResolvedValue([grant]),
      createUnlessExists: vi.fn().mockResolvedValue(grant),
      updateBy: vi.fn().mockResolvedValue({ ...grant, role: "admin" }),
      deleteBy: vi.fn().mockResolvedValue(grant)
    });
    projectMemberRepository.accessibleBy.mockReturnValue(projectMemberRepository);
    const organizationMemberRepository = mock<OrganizationMemberRepository>({
      findOneByAndLock: vi
        .fn()
        .mockResolvedValue(createOrganizationMember({ organizationId: project.organizationId, userId: grant.userId, role: input.targetRole ?? "member" }))
    });
    const organizationActivityService = mock<OrganizationActivityService>();
    const authService = mock<AuthService>({ currentUser: user });
    authService.ability = ability;
    const txService = mock<TxService>({ transaction: vi.fn(callback => callback()) });

    const service = new ProjectMemberService(
      projectMemberRepository,
      projectRepository,
      organizationMemberRepository,
      organizationActivityService,
      authService,
      txService
    );

    return {
      service,
      projectRepository,
      projectMemberRepository,
      organizationMemberRepository,
      organizationActivityService,
      txService,
      ability,
      user,
      project,
      grant
    };
  }
});
