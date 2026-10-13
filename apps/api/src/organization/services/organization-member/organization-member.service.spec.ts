import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { TxService } from "@src/core/services";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type {
  OrganizationMemberOutput,
  OrganizationMemberRepository,
  OrganizationMemberWithUser
} from "@src/organization/repositories/organization-member/organization-member.repository";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import {
  LAST_OWNER_ERROR_CODE,
  OrganizationMemberService,
  OWNER_ROLE_RESTRICTED_ERROR_CODE,
  PERSONAL_ORGANIZATION_ERROR_CODE
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

  describe("updateRole", () => {
    it("changes the role of a member and returns the member with their user", async () => {
      const member = createOrganizationMember({ role: "member" });
      const { service, context, repositories, organizationMemberRepository, updatedMember, ability } = setup({
        member,
        callerIsOwner: true
      });

      await expect(service.updateRole(member.id, "admin")).resolves.toEqual(updatedMember);
      expect(organizationMemberRepository.lockOwners).toHaveBeenCalledTimes(1);
      expect(organizationMemberRepository.lockOwners).toHaveBeenCalledWith(context.organizationId);
      expect(organizationMemberRepository.accessibleBy).toHaveBeenCalledWith(ability, "update");
      expect(repositories.update.updateById).toHaveBeenCalledWith(member.id, { role: "admin" });
      expect(repositories.read.findById).toHaveBeenCalledWith(member.id);
      expect(repositories.read.findWithUserById).toHaveBeenCalledWith(member.id);
    });

    it("runs the checks and the write in one transaction", async () => {
      const member = createOrganizationMember();
      const { service, txService, organizationMemberRepository, repositories } = setup({ member, callerIsOwner: true });
      txService.transaction.mockImplementation(async () => undefined);

      await service.updateRole(member.id, "admin");

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

      await expect(service.updateRole(member.id, "admin")).rejects.toMatchObject({
        status: 403,
        errorCode: PERSONAL_ORGANIZATION_ERROR_CODE,
        message: "Members of a personal organization cannot be changed"
      });
      expect(organizationMemberRepository.lockOwners).not.toHaveBeenCalled();
    });

    it("answers not found for a member outside the active organization", async () => {
      const { service, repositories } = setup({ member: undefined, callerIsOwner: true });

      await expect(service.updateRole(faker.string.uuid(), "admin")).rejects.toMatchObject({ status: 404, message: "Organization member not found" });
      expect(repositories.update.updateById).not.toHaveBeenCalled();
    });

    it("answers not found when the member is gone once written", async () => {
      const member = createOrganizationMember();
      const { service, repositories } = setup({ member, callerIsOwner: true });
      repositories.read.findWithUserById.mockResolvedValue(undefined);

      await expect(service.updateRole(member.id, "admin")).rejects.toMatchObject({ status: 404, message: "Organization member not found" });
    });

    it("refuses to let a caller who is not an owner promote anyone to owner", async () => {
      const member = createOrganizationMember({ role: "member" });
      const { service, repositories } = setup({ member, otherOwners: [createOrganizationMember({ role: "owner" })] });

      await expect(service.updateRole(member.id, "owner")).rejects.toMatchObject({
        status: 403,
        errorCode: OWNER_ROLE_RESTRICTED_ERROR_CODE,
        message: "Only an owner can grant, change or remove the owner role"
      });
      expect(repositories.update.updateById).not.toHaveBeenCalled();
    });

    it("refuses to let a caller who is not an owner change an owner", async () => {
      const owner = createOrganizationMember({ role: "owner" });
      const { service, repositories } = setup({ member: owner, otherOwners: [owner] });

      await expect(service.updateRole(owner.id, "member")).rejects.toMatchObject({ status: 403, errorCode: OWNER_ROLE_RESTRICTED_ERROR_CODE });
      expect(repositories.update.updateById).not.toHaveBeenCalled();
    });

    it("lets a caller who is not an owner change roles below owner", async () => {
      const member = createOrganizationMember({ role: "member" });
      const { service, repositories } = setup({ member, otherOwners: [createOrganizationMember({ role: "owner" })] });

      await service.updateRole(member.id, "billing");

      expect(repositories.update.updateById).toHaveBeenCalledWith(member.id, { role: "billing" });
    });

    it("lets an owner promote a member to owner without checking the remaining owners", async () => {
      const member = createOrganizationMember({ role: "member" });
      const { service, repositories, organizationMemberRepository } = setup({ member, callerIsOwner: true });

      await service.updateRole(member.id, "owner");

      expect(repositories.update.updateById).toHaveBeenCalledWith(member.id, { role: "owner" });
      expect(organizationMemberRepository.lockOwners).toHaveBeenCalledTimes(1);
    });

    it("lets an owner keep another owner an owner without checking the remaining owners", async () => {
      const coOwner = createOrganizationMember({ role: "owner" });
      const { service, organizationMemberRepository } = setup({ member: coOwner, callerIsOwner: true, otherOwners: [coOwner] });

      await service.updateRole(coOwner.id, "owner");

      expect(organizationMemberRepository.lockOwners).toHaveBeenCalledTimes(1);
    });

    it("lets an owner demote another owner while an owner remains", async () => {
      const coOwner = createOrganizationMember({ role: "owner" });
      const { service, repositories, organizationMemberRepository } = setup({ member: coOwner, callerIsOwner: true, otherOwners: [coOwner] });

      await service.updateRole(coOwner.id, "admin");

      expect(organizationMemberRepository.lockOwners).toHaveBeenCalledTimes(2);
      expect(repositories.update.updateById).toHaveBeenCalledWith(coOwner.id, { role: "admin" });
    });

    it("refuses to demote the last owner", async () => {
      const { service, repositories, owners } = setup({ callerIsOwner: true });
      repositories.read.findById.mockResolvedValue(owners[0]);

      await expect(service.updateRole(owners[0].id, "admin")).rejects.toMatchObject({ status: 409, errorCode: LAST_OWNER_ERROR_CODE });
      expect(repositories.update.updateById).not.toHaveBeenCalled();
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

    it("runs the checks and the removal in one transaction", async () => {
      const member = createOrganizationMember();
      const { service, txService, repositories } = setup({ member, callerIsOwner: true });
      txService.transaction.mockImplementation(async () => undefined);

      await service.removeMember(member.id);

      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(repositories.delete.deleteById).not.toHaveBeenCalled();
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
      const { service, repositories, owners } = setup({ callerIsOwner: true });
      repositories.read.findById.mockResolvedValue(owners[0]);

      await expect(service.removeMember(owners[0].id)).rejects.toMatchObject({ status: 409, errorCode: LAST_OWNER_ERROR_CODE });
      expect(repositories.delete.deleteById).not.toHaveBeenCalled();
    });
  });

  describe("transferOwnership", () => {
    it("makes the member an owner and the calling owner an admin", async () => {
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
    context?: OrganizationContext | null;
  }) {
    const caller = createUser();
    const context = input.context === undefined ? createOrganizationContext() : input.context;
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
    const organizationMemberRepository = mock<OrganizationMemberRepository>({ lockOwners: vi.fn().mockResolvedValue(owners) });
    organizationMemberRepository.accessibleBy.mockImplementation((_, action) => repositories[action as keyof typeof repositories]);
    const authService = mock<AuthService>({ currentUser: caller });
    authService.ability = ability;
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get.calledWith("ORGANIZATION_CONTEXT").mockReturnValue(context ?? undefined);
    const txService = mock<TxService>({ transaction: vi.fn(cb => cb()) });
    const service = new OrganizationMemberService(organizationMemberRepository, authService, executionContextService, txService);

    return {
      service,
      owners,
      updatedMember,
      ability,
      repositories,
      organizationMemberRepository,
      txService,
      context: context ?? createOrganizationContext()
    };
  }
});
