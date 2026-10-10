import assert from "http-assert";
import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import {
  type OrganizationMemberOutput,
  OrganizationMemberRepository,
  type OrganizationMemberWithUser
} from "@src/organization/repositories/organization-member/organization-member.repository";
import type { OrganizationContext } from "@src/organization/types/organization-context";

export const LAST_OWNER_ERROR_CODE = "last_owner";
export const OWNER_ROLE_RESTRICTED_ERROR_CODE = "owner_role_restricted";
export const PERSONAL_ORGANIZATION_ERROR_CODE = "personal_organization";

type MemberAction = "read" | "update" | "delete";

@singleton()
export class OrganizationMemberService {
  constructor(
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    private readonly txService: TxService
  ) {}

  async listMembers(): Promise<OrganizationMemberWithUser[]> {
    const { organizationId } = this.#activeOrganization();

    return await this.#repositoryFor("read").findAllWithUsers(organizationId);
  }

  async updateRole(id: OrganizationMemberOutput["id"], role: OrganizationRole): Promise<OrganizationMemberWithUser> {
    const { organizationId } = this.#activeTeamOrganization();

    await this.txService.transaction(async () => {
      const owners = await this.organizationMemberRepository.lockOwners(organizationId);
      const member = await this.#findMember(id);
      this.#assertOwnerRoleUntouchedByNonOwner(owners, [member.role, role]);

      if (member.role === "owner" && role !== "owner") {
        await this.assertAnotherOwnerRemains(organizationId, member.userId);
      }

      await this.#repositoryFor("update").updateById(member.id, { role });
    });

    return await this.#findMemberWithUser(id);
  }

  async removeMember(id: OrganizationMemberOutput["id"]): Promise<void> {
    const { organizationId } = this.#activeTeamOrganization();

    await this.txService.transaction(async () => {
      const owners = await this.organizationMemberRepository.lockOwners(organizationId);
      const member = await this.#findMember(id);
      this.#assertOwnerRoleUntouchedByNonOwner(owners, [member.role]);

      if (member.role === "owner") {
        await this.assertAnotherOwnerRemains(organizationId, member.userId);
      }

      await this.#repositoryFor("delete").deleteById(member.id);
    });
  }

  async transferOwnership(id: OrganizationMemberOutput["id"]): Promise<OrganizationMemberWithUser> {
    const { organizationId } = this.#activeTeamOrganization();

    await this.txService.transaction(async () => {
      const owners = await this.organizationMemberRepository.lockOwners(organizationId);
      const callerMembership = owners.find(owner => owner.userId === this.authService.currentUser.id);

      if (!callerMembership) {
        throw ownerRoleRestricted();
      }

      const member = await this.#findMember(id);
      assert(member.id !== callerMembership.id, 400, "Ownership can only be transferred to another member");

      const repository = this.#repositoryFor("update");
      await repository.updateById(member.id, { role: "owner" });
      await repository.updateById(callerMembership.id, { role: "admin" });
    });

    return await this.#findMemberWithUser(id);
  }

  /** Call it inside the transaction that demotes or removes the member, so the owner lock it takes outlives the check. */
  async assertAnotherOwnerRemains(organizationId: string, userId: string): Promise<void> {
    const owners = await this.organizationMemberRepository.lockOwners(organizationId);
    const remainingOwners = owners.filter(owner => owner.userId !== userId);

    if (remainingOwners.length === 0) {
      throw createError(409, "An organization needs at least one owner", { errorCode: LAST_OWNER_ERROR_CODE });
    }
  }

  #assertOwnerRoleUntouchedByNonOwner(owners: OrganizationMemberOutput[], roles: OrganizationRole[]) {
    const callerIsOwner = owners.some(owner => owner.userId === this.authService.currentUser.id);

    if (!callerIsOwner && roles.includes("owner")) {
      throw ownerRoleRestricted();
    }
  }

  async #findMember(id: OrganizationMemberOutput["id"]): Promise<OrganizationMemberOutput> {
    const member = await this.#repositoryFor("read").findById(id);
    assert(member, 404, "Organization member not found");

    return member;
  }

  async #findMemberWithUser(id: OrganizationMemberOutput["id"]): Promise<OrganizationMemberWithUser> {
    const member = await this.#repositoryFor("read").findWithUserById(id);
    assert(member, 404, "Organization member not found");

    return member;
  }

  #repositoryFor(action: MemberAction): OrganizationMemberRepository {
    return this.organizationMemberRepository.accessibleBy(this.authService.ability, action);
  }

  #activeTeamOrganization(): OrganizationContext {
    const context = this.#activeOrganization();

    if (context.organizationType === "personal") {
      throw createError(403, "Members of a personal organization cannot be changed", { errorCode: PERSONAL_ORGANIZATION_ERROR_CODE });
    }

    return context;
  }

  #activeOrganization(): OrganizationContext {
    const context = this.executionContextService.get("ORGANIZATION_CONTEXT");
    assert(context, 403, "No active organization");

    return context;
  }
}

function ownerRoleRestricted() {
  return createError(403, "Only an owner can grant, change or remove the owner role", { errorCode: OWNER_ROLE_RESTRICTED_ERROR_CODE });
}
