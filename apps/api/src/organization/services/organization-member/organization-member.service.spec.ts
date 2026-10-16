import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { TxService } from "@src/core/services";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type {
  OrganizationMemberOutput,
  OrganizationMemberRepository,
  OrganizationMemberWithUser
} from "@src/organization/repositories/organization-member/organization-member.repository";
import type { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import type { ProjectGrantOfMember, ProjectMemberRepository } from "@src/organization/repositories/project-member/project-member.repository";
import type { DepartedMemberAlertsService } from "@src/organization/services/departed-member-alerts/departed-member-alerts.service";
import type { OrganizationActivityService } from "@src/organization/services/organization-activity/organization-activity.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import {
  LAST_OWNER_ERROR_CODE,
  OrganizationMemberService,
  OWNER_CANNOT_LEAVE_ERROR_CODE,
  OWNER_ROLE_RESTRICTED_ERROR_CODE,
  PERSONAL_ORGANIZATION_ERROR_CODE,
  PROJECT_ACCESS_REQUIRED_ERROR_CODE
} from "./organization-member.service";

import { createOrganizationMember, createOrganizationMemberWithUser } from "@test/seeders/organization.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(OrganizationMemberService.name, () => {
  describe("listMembers", () => {
    it("lists the members of the active organization the caller may read", async () => {
      const members = [createOrganizationMemberWithUser(), createOrganizationMemberWithUser({ username: null, email: null })];
      const { service, context, repositories, ability, organizationMemberRepository } = setup({});
      repositories.read.findAllWithUsers.mockResolvedValue(members);

      await expect(service.listMembers()).resolves.toEqual(members);
      expect(organizationMemberRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(repositories.read.findAllWithUsers).toHaveBeenCalledWith(context.organizationId);
    });

    it("lists the members of a personal organization too", async () => {
      const { service, repositories } = setup({ context: createOrganizationContext({ organizationType: "personal" }) });
      repositories.read.findAllWithUsers.mockResolvedValue([]);

      await expect(service.listMembers()).resolves.toEqual([]);
    });

    it("refuses a request without an active organization", async () => {
      const { service } = setup({ context: null });

      await expect(service.listMembers()).rejects.toMatchObject({ status: 403, message: "No active organization" });
    });
  });

  describe("listProjectGrantsOf", () => {
    it("lists the live project grants of a member of the active organization through the caller's grant rules", async () => {
      const member = createOrganizationMember({ role: "member" });
      const grants: ProjectGrantOfMember[] = [{ projectId: faker.string.uuid(), role: "admin" }];
      const { service, context, ability, repositories, projectMemberRepository, projectMemberReads } = setup({ member, grants });

      await expect(service.listProjectGrantsOf(member.id)).resolves.toEqual(grants);
      expect(repositories.read.findById).toHaveBeenCalledWith(member.id);
      expect(projectMemberRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(projectMemberReads.findLiveGrantsOf).toHaveBeenCalledWith(context.organizationId, member.userId);
    });

    it("answers not found for a member outside the active organization", async () => {
      const { service, projectMemberReads } = setup({ member: undefined });

      await expect(service.listProjectGrantsOf(faker.string.uuid())).rejects.toMatchObject({ status: 404, message: "Organization member not found" });
      expect(projectMemberReads.findLiveGrantsOf).not.toHaveBeenCalled();
    });

    it("refuses a request without an active organization", async () => {
      const { service } = setup({ member: createOrganizationMember(), context: null });

      await expect(service.listProjectGrantsOf(faker.string.uuid())).rejects.toMatchObject({ status: 403, message: "No active organization" });
    });
  });

  describe("update", () => {
    it("changes the role of a member and returns the member with their user", async () => {
      const member = createOrganizationMember({ role: "member" });
      const { service, context, repositories, organizationMemberRepository, updatedMember, ability } = setup({
        member,
        callerIsOwner: true
      });

      await expect(service.update(member.id, { role: "admin" })).resolves.toEqual(updatedMember);
      expect(organizationMemberRepository.lockOwners).toHaveBeenCalledTimes(1);
      expect(organizationMemberRepository.lockOwners).toHaveBeenCalledWith(context.organizationId);
      expect(organizationMemberRepository.accessibleBy).toHaveBeenCalledWith(ability, "update");
      expect(repositories.update.updateById).toHaveBeenCalledWith(member.id, { role: "admin", projectAccess: member.projectAccess });
      expect(repositories.read.findById).toHaveBeenCalledWith(member.id);
      expect(repositories.read.findWithUserById).toHaveBeenCalledWith(member.id);
    });

    it("runs the checks and the write in one transaction", async () => {
      const member = createOrganizationMember();
      const { service, txService, organizationMemberRepository, repositories } = setup({ member, callerIsOwner: true });
      txService.transaction.mockImplementation(async () => undefined);

      await service.update(member.id, { role: "admin" });

      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(organizationMemberRepository.lockOwners).not.toHaveBeenCalled();
      expect(repositories.update.updateById).not.toHaveBeenCalled();
    });

    it("refuses to change a member of a personal organization", async () => {
      const member = createOrganizationMember();
      const { service, organizationMemberRepository } = setup({
        member,
        callerIsOwner: true,
        context: createOrganizationContext({ organizationType: "personal" })
      });

      await expect(service.update(member.id, { role: "admin" })).rejects.toMatchObject({
        status: 403,
        errorCode: PERSONAL_ORGANIZATION_ERROR_CODE,
        message: "Members of a personal organization cannot be changed"
      });
      expect(organizationMemberRepository.lockOwners).not.toHaveBeenCalled();
    });

    it("answers not found for a member outside the active organization", async () => {
      const { service, repositories } = setup({ member: undefined, callerIsOwner: true });

      await expect(service.update(faker.string.uuid(), { role: "admin" })).rejects.toMatchObject({ status: 404, message: "Organization member not found" });
      expect(repositories.update.updateById).not.toHaveBeenCalled();
    });

    it("answers not found when the member is gone once written", async () => {
      const member = createOrganizationMember();
      const { service, repositories } = setup({ member, callerIsOwner: true });
      repositories.read.findWithUserById.mockResolvedValue(undefined);

      await expect(service.update(member.id, { role: "admin" })).rejects.toMatchObject({ status: 404, message: "Organization member not found" });
    });

    it("refuses to let a caller who is not an owner promote anyone to owner", async () => {
      const member = createOrganizationMember({ role: "member" });
      const { service, repositories } = setup({ member, otherOwners: [createOrganizationMember({ role: "owner" })] });

      await expect(service.update(member.id, { role: "owner" })).rejects.toMatchObject({
        status: 403,
        errorCode: OWNER_ROLE_RESTRICTED_ERROR_CODE,
        message: "Only an owner can grant, change or remove the owner role"
      });
      expect(repositories.update.updateById).not.toHaveBeenCalled();
    });

    it("refuses to let a caller who is not an owner change an owner", async () => {
      const owner = createOrganizationMember({ role: "owner" });
      const { service, repositories } = setup({ member: owner, otherOwners: [owner] });

      await expect(service.update(owner.id, { role: "member" })).rejects.toMatchObject({ status: 403, errorCode: OWNER_ROLE_RESTRICTED_ERROR_CODE });
      expect(repositories.update.updateById).not.toHaveBeenCalled();
    });

    it("lets a caller who is not an owner change roles below owner", async () => {
      const member = createOrganizationMember({ role: "member" });
      const { service, repositories } = setup({ member, otherOwners: [createOrganizationMember({ role: "owner" })] });

      await service.update(member.id, { role: "billing" });

      expect(repositories.update.updateById).toHaveBeenCalledWith(member.id, { role: "billing", projectAccess: member.projectAccess });
    });

    it("lets an owner promote a member to owner without checking the remaining owners", async () => {
      const member = createOrganizationMember({ role: "member" });
      const { service, repositories, organizationMemberRepository } = setup({ member, callerIsOwner: true });

      await service.update(member.id, { role: "owner" });

      expect(repositories.update.updateById).toHaveBeenCalledWith(member.id, { role: "owner", projectAccess: member.projectAccess });
      expect(organizationMemberRepository.lockOwners).toHaveBeenCalledTimes(1);
    });

    it("lets an owner keep another owner an owner without checking the remaining owners", async () => {
      const coOwner = createOrganizationMember({ role: "owner" });
      const { service, organizationMemberRepository } = setup({ member: coOwner, callerIsOwner: true, otherOwners: [coOwner] });

      await service.update(coOwner.id, { role: "owner" });

      expect(organizationMemberRepository.lockOwners).toHaveBeenCalledTimes(1);
    });

    it("lets an owner demote another owner while an owner remains", async () => {
      const coOwner = createOrganizationMember({ role: "owner" });
      const { service, repositories, organizationMemberRepository } = setup({ member: coOwner, callerIsOwner: true, otherOwners: [coOwner] });

      await service.update(coOwner.id, { role: "admin" });

      expect(organizationMemberRepository.lockOwners).toHaveBeenCalledTimes(2);
      expect(repositories.update.updateById).toHaveBeenCalledWith(coOwner.id, { role: "admin", projectAccess: coOwner.projectAccess });
    });

    it("refuses to demote the last owner", async () => {
      const { service, repositories, owners } = setup({ callerIsOwner: true });
      repositories.read.findById.mockResolvedValue(owners[0]);

      await expect(service.update(owners[0].id, { role: "admin" })).rejects.toMatchObject({ status: 409, errorCode: LAST_OWNER_ERROR_CODE });
      expect(repositories.update.updateById).not.toHaveBeenCalled();
    });

    it.each<[OrganizationRole, OrganizationRole]>([
      ["admin", "member"],
      ["admin", "viewer"],
      ["billing", "member"],
      ["owner", "viewer"]
    ])("refuses to move someone from %s to %s without stating their project access", async (from, to) => {
      const member = createOrganizationMember({ role: from, projectAccess: "all" });
      const { service, repositories } = setup({ member, callerIsOwner: true, otherOwners: [member] });

      await expect(service.update(member.id, { role: to })).rejects.toMatchObject({
        status: 400,
        errorCode: PROJECT_ACCESS_REQUIRED_ERROR_CODE,
        message: "Choose the project access of someone who becomes a member or viewer"
      });
      expect(repositories.update.updateById).not.toHaveBeenCalled();
    });

    it("makes an admin a member of every project when asked to, without looking for grants", async () => {
      const member = createOrganizationMember({ role: "admin", projectAccess: "selected" });
      const { service, repositories, projectMemberReads } = setup({ member, callerIsOwner: true });

      await service.update(member.id, { role: "member", projectAccess: "all" });

      expect(repositories.update.updateById).toHaveBeenCalledWith(member.id, { role: "member", projectAccess: "all" });
      expect(projectMemberReads.findLiveGrantsOf).not.toHaveBeenCalled();
    });

    it("removes the grants below project admin of a member switched to every project, keeping their role", async () => {
      const member = createOrganizationMember({ role: "member", projectAccess: "selected" });
      const { service, repositories, projectMemberRepository, projectMemberReads, ability } = setup({ member, callerIsOwner: true });

      await service.update(member.id, { projectAccess: "all" });

      expect(repositories.update.updateById).toHaveBeenCalledWith(member.id, { role: "member", projectAccess: "all" });
      expect(projectMemberRepository.accessibleBy).toHaveBeenCalledWith(ability, "update");
      expect(projectMemberReads.deleteGrantsBelowAdminOf).toHaveBeenCalledWith({ organizationId: member.organizationId, userId: member.userId });
      expect(projectMemberReads.replaceGrantsOf).not.toHaveBeenCalled();
    });

    it("replaces the grants of a member on specific projects with the live projects given", async () => {
      const member = createOrganizationMember({ role: "viewer", projectAccess: "all" });
      const projectGrants = [
        { projectId: faker.string.uuid(), role: "viewer" as const },
        { projectId: faker.string.uuid(), role: "admin" as const }
      ];
      const { service, repositories, projectRepository, projectReads, projectMemberReads, ability } = setup({ member, callerIsOwner: true });

      await service.update(member.id, { projectAccess: "selected", projectGrants });

      expect(projectRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(projectReads.findActiveIdsAmong).toHaveBeenCalledWith(
        member.organizationId,
        projectGrants.map(grant => grant.projectId)
      );
      expect(repositories.update.updateById).toHaveBeenCalledWith(member.id, { role: "viewer", projectAccess: "selected" });
      expect(projectMemberReads.replaceGrantsOf).toHaveBeenCalledWith({ organizationId: member.organizationId, userId: member.userId }, projectGrants);
      expect(projectMemberReads.findLiveGrantsOf).not.toHaveBeenCalled();
      expect(projectMemberReads.deleteGrantsBelowAdminOf).not.toHaveBeenCalled();
    });

    it("leaves the grants alone when a member on specific projects only becomes a viewer", async () => {
      const member = createOrganizationMember({ role: "member", projectAccess: "selected" });
      const { service, projectMemberReads } = setup({ member, callerIsOwner: true, grants: [{ projectId: faker.string.uuid(), role: "member" }] });

      await service.update(member.id, { role: "viewer" });

      expect(projectMemberReads.replaceGrantsOf).not.toHaveBeenCalled();
      expect(projectMemberReads.deleteGrantsBelowAdminOf).not.toHaveBeenCalled();
    });

    it("leaves the grants alone when someone becomes an admin", async () => {
      const member = createOrganizationMember({ role: "member", projectAccess: "all" });
      const { service, projectMemberReads } = setup({ member, callerIsOwner: true });

      await service.update(member.id, { role: "admin" });

      expect(projectMemberReads.replaceGrantsOf).not.toHaveBeenCalled();
      expect(projectMemberReads.deleteGrantsBelowAdminOf).not.toHaveBeenCalled();
    });

    it.each([
      ["a member on every project", { role: "member", projectAccess: "all" }, {}],
      ["someone switched to every project", { role: "member", projectAccess: "selected" }, { projectAccess: "all" }],
      ["an admin", { role: "admin", projectAccess: "selected" }, {}],
      ["a billing member", { role: "billing", projectAccess: "selected" }, {}]
    ] as const)("refuses project grants for %s", async (_, stored, change) => {
      const member = createOrganizationMember(stored);
      const { service, repositories, projectMemberReads } = setup({ member, callerIsOwner: true });

      await expect(service.update(member.id, { ...change, projectGrants: [{ projectId: faker.string.uuid(), role: "member" }] })).rejects.toMatchObject({
        status: 400,
        message: "Project grants only apply to a member or viewer with access to specific projects"
      });
      expect(repositories.update.updateById).not.toHaveBeenCalled();
      expect(projectMemberReads.replaceGrantsOf).not.toHaveBeenCalled();
    });

    it("refuses an empty set of grants for a member on specific projects", async () => {
      const member = createOrganizationMember({ role: "member", projectAccess: "selected" });
      const { service, repositories } = setup({ member, callerIsOwner: true });

      await expect(service.update(member.id, { projectGrants: [] })).rejects.toMatchObject({
        status: 400,
        message: "A member or viewer with access to specific projects needs at least one project grant"
      });
      expect(repositories.update.updateById).not.toHaveBeenCalled();
    });

    it("refuses grants naming a project that is not live in the organization", async () => {
      const member = createOrganizationMember({ role: "member", projectAccess: "selected" });
      const liveProjectId = faker.string.uuid();
      const { service, repositories, projectMemberReads } = setup({ member, callerIsOwner: true, liveProjectIds: [liveProjectId] });

      await expect(
        service.update(member.id, {
          projectGrants: [
            { projectId: liveProjectId, role: "member" },
            { projectId: faker.string.uuid(), role: "member" }
          ]
        })
      ).rejects.toMatchObject({ status: 400, message: "Every project grant must name a live project of the organization" });
      expect(repositories.update.updateById).not.toHaveBeenCalled();
      expect(projectMemberReads.replaceGrantsOf).not.toHaveBeenCalled();
    });

    it.each([
      ["member", "all", "all"],
      ["viewer", "selected", "selected"],
      ["admin", "selected", "all"],
      ["billing", "all", null]
    ] as const)("records the change of someone who ends up %s on %s project access as %s", async (role, storedAccess, recordedAccess) => {
      const member = createOrganizationMember({ role, projectAccess: storedAccess });
      const { service, caller, context, updatedMember, organizationActivityService } = setup({
        member,
        callerIsOwner: true,
        grants: [{ projectId: faker.string.uuid(), role: "viewer" }]
      });

      await service.update(member.id, { role });

      expect(organizationActivityService.record).toHaveBeenCalledWith({
        organizationId: context.organizationId,
        type: "member_updated",
        actorUserId: caller.id,
        payload: { userId: updatedMember.userId, username: updatedMember.username, role, projectAccess: recordedAccess }
      });
    });

    it("records nothing when the change is refused", async () => {
      const member = createOrganizationMember({ role: "admin" });
      const { service, organizationActivityService } = setup({ member, callerIsOwner: true });

      await expect(service.update(member.id, { role: "member" })).rejects.toMatchObject({ status: 400 });
      expect(organizationActivityService.record).not.toHaveBeenCalled();
    });

    it("makes a billing member a viewer of specific projects while they hold a project grant", async () => {
      const member = createOrganizationMember({ role: "billing", projectAccess: "all" });
      const { service, repositories, projectMemberRepository, projectMemberReads } = setup({
        member,
        callerIsOwner: true,
        grants: [{ projectId: faker.string.uuid(), role: "viewer" }]
      });

      await service.update(member.id, { role: "viewer", projectAccess: "selected" });

      expect(projectMemberRepository.unscoped).toHaveBeenCalledWith("member-access-validation");
      expect(projectMemberReads.findLiveGrantsOf).toHaveBeenCalledWith(member.organizationId, member.userId);
      expect(repositories.update.updateById).toHaveBeenCalledWith(member.id, { role: "viewer", projectAccess: "selected" });
    });

    it.each<[OrganizationRole, OrganizationRole]>([
      ["admin", "member"],
      ["member", "viewer"]
    ])("refuses to move someone from %s to %s on specific projects while they hold no project grant", async (from, to) => {
      const member = createOrganizationMember({ role: from, projectAccess: "selected" });
      const { service, repositories } = setup({ member, callerIsOwner: true, grants: [] });

      await expect(service.update(member.id, { role: to, projectAccess: "selected" })).rejects.toMatchObject({
        status: 400,
        message: "A member or viewer with access to specific projects needs at least one project grant"
      });
      expect(repositories.update.updateById).not.toHaveBeenCalled();
    });

    it("keeps the stored project access when a member becomes a viewer", async () => {
      const member = createOrganizationMember({ role: "member", projectAccess: "all" });
      const { service, repositories } = setup({ member, callerIsOwner: true });

      await service.update(member.id, { role: "viewer" });

      expect(repositories.update.updateById).toHaveBeenCalledWith(member.id, { role: "viewer", projectAccess: "all" });
    });

    it("keeps the stored project access of someone who leaves member or viewer, whatever is asked", async () => {
      const member = createOrganizationMember({ role: "member", projectAccess: "selected" });
      const { service, repositories, projectMemberReads } = setup({ member, callerIsOwner: true });

      await service.update(member.id, { role: "admin", projectAccess: "all" });

      expect(repositories.update.updateById).toHaveBeenCalledWith(member.id, { role: "admin", projectAccess: "selected" });
      expect(projectMemberReads.findLiveGrantsOf).not.toHaveBeenCalled();
    });
  });

  describe("removeMember", () => {
    it("removes a member of the active organization", async () => {
      const member = createOrganizationMember({ role: "member" });
      const { service, context, repositories, organizationMemberRepository, ability } = setup({ member, callerIsOwner: true });

      await service.removeMember(member.id);

      expect(organizationMemberRepository.lockOwners).toHaveBeenCalledTimes(1);
      expect(organizationMemberRepository.lockOwners).toHaveBeenCalledWith(context.organizationId);
      expect(organizationMemberRepository.accessibleBy).toHaveBeenCalledWith(ability, "delete");
      expect(repositories.delete.deleteById).toHaveBeenCalledWith(member.id);
    });

    it("stops the team's alerts to the removed member", async () => {
      const member = createOrganizationMember({ role: "member" });
      const { service, context, departedMemberAlertsService } = setup({ member, callerIsOwner: true });

      await service.removeMember(member.id);

      expect(departedMemberAlertsService.stopTeamAlertsTo).toHaveBeenCalledWith(member.userId, context.organizationId);
    });

    it("runs the checks, the removal and the alert stop in one transaction", async () => {
      const member = createOrganizationMember();
      const { service, txService, repositories, departedMemberAlertsService } = setup({ member, callerIsOwner: true });
      txService.transaction.mockImplementation(async () => undefined);

      await service.removeMember(member.id);

      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(repositories.delete.deleteById).not.toHaveBeenCalled();
      expect(departedMemberAlertsService.stopTeamAlertsTo).not.toHaveBeenCalled();
    });

    it("refuses to remove a member of a personal organization", async () => {
      const member = createOrganizationMember();
      const { service, repositories } = setup({
        member,
        callerIsOwner: true,
        context: createOrganizationContext({ organizationType: "personal" })
      });

      await expect(service.removeMember(member.id)).rejects.toMatchObject({ status: 403, errorCode: PERSONAL_ORGANIZATION_ERROR_CODE });
      expect(repositories.delete.deleteById).not.toHaveBeenCalled();
    });

    it("answers not found for a member outside the active organization", async () => {
      const { service, repositories } = setup({ member: undefined, callerIsOwner: true });

      await expect(service.removeMember(faker.string.uuid())).rejects.toMatchObject({ status: 404 });
      expect(repositories.delete.deleteById).not.toHaveBeenCalled();
    });

    it("refuses to let a caller who is not an owner remove an owner", async () => {
      const owner = createOrganizationMember({ role: "owner" });
      const { service, repositories } = setup({ member: owner, otherOwners: [owner, createOrganizationMember({ role: "owner" })] });

      await expect(service.removeMember(owner.id)).rejects.toMatchObject({ status: 403, errorCode: OWNER_ROLE_RESTRICTED_ERROR_CODE });
      expect(repositories.delete.deleteById).not.toHaveBeenCalled();
    });

    it("lets a caller who is not an owner remove a member below owner", async () => {
      const member = createOrganizationMember({ role: "admin" });
      const { service, repositories, organizationMemberRepository } = setup({ member, otherOwners: [createOrganizationMember({ role: "owner" })] });

      await service.removeMember(member.id);

      expect(repositories.delete.deleteById).toHaveBeenCalledWith(member.id);
      expect(organizationMemberRepository.lockOwners).toHaveBeenCalledTimes(1);
    });

    it("lets an owner remove another owner while an owner remains", async () => {
      const coOwner = createOrganizationMember({ role: "owner" });
      const { service, repositories, organizationMemberRepository } = setup({ member: coOwner, callerIsOwner: true, otherOwners: [coOwner] });

      await service.removeMember(coOwner.id);

      expect(organizationMemberRepository.lockOwners).toHaveBeenCalledTimes(2);
      expect(repositories.delete.deleteById).toHaveBeenCalledWith(coOwner.id);
    });

    it("refuses to remove the last owner", async () => {
      const { service, repositories, owners, departedMemberAlertsService } = setup({ callerIsOwner: true });
      repositories.read.findById.mockResolvedValue(owners[0]);

      await expect(service.removeMember(owners[0].id)).rejects.toMatchObject({ status: 409, errorCode: LAST_OWNER_ERROR_CODE });
      expect(repositories.delete.deleteById).not.toHaveBeenCalled();
      expect(departedMemberAlertsService.stopTeamAlertsTo).not.toHaveBeenCalled();
    });
  });

  describe("leave", () => {
    it("ends the caller's own membership of the active team and stops the team's alerts to them", async () => {
      const { service, context, caller, callerMembership, organizationMemberRepository, departedMemberAlertsService } = setup({ callerRole: "member" });

      await service.leave(context.organizationId);

      expect(organizationMemberRepository.lockOwners).toHaveBeenCalledWith(context.organizationId);
      expect(organizationMemberRepository.findOneBy).toHaveBeenCalledWith({ organizationId: context.organizationId, userId: caller.id });
      expect(organizationMemberRepository.deleteById).toHaveBeenCalledWith(callerMembership?.id);
      expect(departedMemberAlertsService.stopTeamAlertsTo).toHaveBeenCalledWith(caller.id, context.organizationId);
      expect(organizationMemberRepository.accessibleBy).not.toHaveBeenCalled();
    });

    it.each(["admin", "billing", "viewer"] as const)("lets a caller with role %s leave", async callerRole => {
      const { service, context, callerMembership, organizationMemberRepository } = setup({ callerRole });

      await service.leave(context.organizationId);

      expect(organizationMemberRepository.deleteById).toHaveBeenCalledWith(callerMembership?.id);
    });

    it("runs the lookup, the removal and the alert stop in one transaction", async () => {
      const { service, context, txService, organizationMemberRepository, departedMemberAlertsService } = setup({ callerRole: "member" });
      txService.transaction.mockImplementation(async () => undefined);

      await service.leave(context.organizationId);

      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(organizationMemberRepository.lockOwners).not.toHaveBeenCalled();
      expect(organizationMemberRepository.deleteById).not.toHaveBeenCalled();
      expect(departedMemberAlertsService.stopTeamAlertsTo).not.toHaveBeenCalled();
    });

    it("refuses the owner, who has to transfer ownership first", async () => {
      const { service, context, organizationMemberRepository, departedMemberAlertsService } = setup({ callerRole: "owner" });

      await expect(service.leave(context.organizationId)).rejects.toMatchObject({
        status: 409,
        errorCode: OWNER_CANNOT_LEAVE_ERROR_CODE,
        message: "Transfer ownership of the organization before leaving it"
      });
      expect(organizationMemberRepository.deleteById).not.toHaveBeenCalled();
      expect(departedMemberAlertsService.stopTeamAlertsTo).not.toHaveBeenCalled();
    });

    it("refuses to leave a personal organization", async () => {
      const context = createOrganizationContext({ organizationType: "personal" });
      const { service, organizationMemberRepository } = setup({ callerRole: "owner", context });

      await expect(service.leave(context.organizationId)).rejects.toMatchObject({
        status: 403,
        errorCode: PERSONAL_ORGANIZATION_ERROR_CODE,
        message: "A personal organization cannot be left"
      });
      expect(organizationMemberRepository.lockOwners).not.toHaveBeenCalled();
    });

    it("answers not found for an organization other than the active one", async () => {
      const { service, organizationMemberRepository } = setup({ callerRole: "member" });

      await expect(service.leave(faker.string.uuid())).rejects.toMatchObject({ status: 404, message: "Organization not found" });
      expect(organizationMemberRepository.lockOwners).not.toHaveBeenCalled();
    });

    it("answers not found when the caller no longer belongs to the active team", async () => {
      const { service, context, organizationMemberRepository } = setup({});

      await expect(service.leave(context.organizationId)).rejects.toMatchObject({ status: 404, message: "Organization not found" });
      expect(organizationMemberRepository.deleteById).not.toHaveBeenCalled();
    });

    it("refuses a request without an active organization", async () => {
      const { service } = setup({ context: null, callerRole: "member" });

      await expect(service.leave(faker.string.uuid())).rejects.toMatchObject({ status: 403, message: "No active organization" });
    });
  });

  describe("transferOwnership", () => {
    it("makes the member an owner and the calling owner an admin without asking for project access", async () => {
      const member = createOrganizationMember({ role: "member" });
      const { service, context, repositories, owners, updatedMember, organizationMemberRepository, ability } = setup({
        member,
        callerIsOwner: true
      });

      await expect(service.transferOwnership(member.id)).resolves.toEqual(updatedMember);
      expect(organizationMemberRepository.lockOwners).toHaveBeenCalledWith(context.organizationId);
      expect(organizationMemberRepository.accessibleBy).toHaveBeenCalledWith(ability, "update");
      expect(repositories.update.updateById.mock.calls).toEqual([
        [member.id, { role: "owner" }],
        [owners[0].id, { role: "admin" }]
      ]);
      expect(repositories.read.findWithUserById).toHaveBeenCalledWith(member.id);
    });

    it("runs the checks and both writes in one transaction", async () => {
      const member = createOrganizationMember();
      const { service, txService, repositories } = setup({ member, callerIsOwner: true });
      txService.transaction.mockImplementation(async () => undefined);

      await service.transferOwnership(member.id);

      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(repositories.update.updateById).not.toHaveBeenCalled();
    });

    it("refuses a caller who is not an owner", async () => {
      const member = createOrganizationMember();
      const { service, repositories } = setup({ member, otherOwners: [createOrganizationMember({ role: "owner" })] });

      await expect(service.transferOwnership(member.id)).rejects.toMatchObject({ status: 403, errorCode: OWNER_ROLE_RESTRICTED_ERROR_CODE });
      expect(repositories.update.updateById).not.toHaveBeenCalled();
    });

    it("refuses a transfer to the calling owner", async () => {
      const { service, repositories, owners } = setup({ callerIsOwner: true });
      repositories.read.findById.mockResolvedValue(owners[0]);

      await expect(service.transferOwnership(owners[0].id)).rejects.toMatchObject({
        status: 400,
        message: "Ownership can only be transferred to another member"
      });
      expect(repositories.update.updateById).not.toHaveBeenCalled();
    });

    it("refuses a transfer in a personal organization", async () => {
      const member = createOrganizationMember();
      const { service, organizationMemberRepository } = setup({
        member,
        callerIsOwner: true,
        context: createOrganizationContext({ organizationType: "personal" })
      });

      await expect(service.transferOwnership(member.id)).rejects.toMatchObject({ status: 403, errorCode: PERSONAL_ORGANIZATION_ERROR_CODE });
      expect(organizationMemberRepository.lockOwners).not.toHaveBeenCalled();
    });

    it("answers not found for a member outside the active organization", async () => {
      const { service, repositories } = setup({ member: undefined, callerIsOwner: true });

      await expect(service.transferOwnership(faker.string.uuid())).rejects.toMatchObject({ status: 404 });
      expect(repositories.update.updateById).not.toHaveBeenCalled();
    });
  });

  describe("assertAnotherOwnerRemains", () => {
    it("lets an owner go while another owner stays", async () => {
      const leaving = createOrganizationMember({ role: "owner" });
      const { service, context } = setup({ otherOwners: [leaving, createOrganizationMember({ role: "owner" })] });

      await expect(service.assertAnotherOwnerRemains(context.organizationId, leaving.userId)).resolves.toBeUndefined();
    });

    it("lets a member who is not an owner go", async () => {
      const { service, context } = setup({ otherOwners: [createOrganizationMember({ role: "owner" })] });

      await expect(service.assertAnotherOwnerRemains(context.organizationId, faker.string.uuid())).resolves.toBeUndefined();
    });

    it("refuses to let the only owner go", async () => {
      const onlyOwner = createOrganizationMember({ role: "owner" });
      const { service, context } = setup({ otherOwners: [onlyOwner] });

      await expect(service.assertAnotherOwnerRemains(context.organizationId, onlyOwner.userId)).rejects.toMatchObject({
        status: 409,
        errorCode: LAST_OWNER_ERROR_CODE,
        message: "An organization needs at least one owner"
      });
    });

    it("locks the owners of the organization it checks", async () => {
      const { service, context, organizationMemberRepository } = setup({ otherOwners: [createOrganizationMember({ role: "owner" })] });

      await service.assertAnotherOwnerRemains(context.organizationId, faker.string.uuid());

      expect(organizationMemberRepository.lockOwners).toHaveBeenCalledWith(context.organizationId);
    });
  });

  function setup(input: {
    callerIsOwner?: boolean;
    otherOwners?: OrganizationMemberOutput[];
    member?: OrganizationMemberOutput;
    callerRole?: OrganizationRole;
    context?: OrganizationContext | null;
    grants?: ProjectGrantOfMember[];
    liveProjectIds?: string[];
  }) {
    const caller = createUser();
    const context = input.context === undefined ? createOrganizationContext() : input.context;
    const callerMembership = input.callerRole
      ? createOrganizationMember({ role: input.callerRole, userId: caller.id, organizationId: context?.organizationId })
      : undefined;
    const callerMemberships = input.callerIsOwner ? [createOrganizationMember({ role: "owner", userId: caller.id })] : [];
    const owners = [...callerMemberships, ...(input.otherOwners ?? [])];
    const updatedMember = createOrganizationMemberWithUser({ id: input.member?.id });
    const ability = createMongoAbility();
    const repositories = {
      read: mock<OrganizationMemberRepository>({
        findById: vi.fn().mockResolvedValue(input.member),
        findWithUserById: vi.fn<(id: string) => Promise<OrganizationMemberWithUser | undefined>>().mockResolvedValue(updatedMember)
      }),
      update: mock<OrganizationMemberRepository>(),
      delete: mock<OrganizationMemberRepository>()
    };
    const organizationMemberRepository = mock<OrganizationMemberRepository>({
      lockOwners: vi.fn().mockResolvedValue(owners),
      findOneBy: vi.fn().mockResolvedValue(callerMembership)
    });
    organizationMemberRepository.accessibleBy.mockImplementation((_, action) => repositories[action as keyof typeof repositories]);
    const authService = mock<AuthService>({ currentUser: caller });
    authService.ability = ability;
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get.calledWith("ORGANIZATION_CONTEXT").mockReturnValue(context ?? undefined);
    const txService = mock<TxService>({ transaction: vi.fn(cb => cb()) });
    const departedMemberAlertsService = mock<DepartedMemberAlertsService>();
    const projectMemberReads = mock<ProjectMemberRepository>({ findLiveGrantsOf: vi.fn().mockResolvedValue(input.grants ?? []) });
    const projectMemberRepository = mock<ProjectMemberRepository>();
    projectMemberRepository.unscoped.mockReturnValue(projectMemberReads);
    projectMemberRepository.accessibleBy.mockReturnValue(projectMemberReads);
    const projectReads = mock<ProjectRepository>({
      findActiveIdsAmong: vi.fn((_organizationId: string, ids: string[]) => Promise.resolve(input.liveProjectIds ?? ids))
    });
    const projectRepository = mock<ProjectRepository>();
    projectRepository.accessibleBy.mockReturnValue(projectReads);
    const organizationActivityService = mock<OrganizationActivityService>();
    const service = new OrganizationMemberService(
      organizationMemberRepository,
      projectMemberRepository,
      projectRepository,
      organizationActivityService,
      authService,
      executionContextService,
      txService,
      departedMemberAlertsService
    );

    return {
      service,
      caller,
      callerMembership,
      owners,
      updatedMember,
      ability,
      repositories,
      organizationMemberRepository,
      projectMemberRepository,
      projectMemberReads,
      projectRepository,
      projectReads,
      organizationActivityService,
      txService,
      departedMemberAlertsService,
      context: context ?? createOrganizationContext()
    };
  }
});
