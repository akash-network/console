import assert from "http-assert";
import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { OrganizationRole, ProjectAccess } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { GRANT_HOLDING_ORGANIZATION_ROLES } from "@src/organization/model-schemas/project-member/project-member.schema";
import {
  type OrganizationMemberOutput,
  OrganizationMemberRepository,
  type OrganizationMemberWithUser
} from "@src/organization/repositories/organization-member/organization-member.repository";
import { ProjectMemberRepository } from "@src/organization/repositories/project-member/project-member.repository";
import { DepartedMemberAlertsService } from "@src/organization/services/departed-member-alerts/departed-member-alerts.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";

export const LAST_OWNER_ERROR_CODE = "last_owner";
export const OWNER_ROLE_RESTRICTED_ERROR_CODE = "owner_role_restricted";
export const PERSONAL_ORGANIZATION_ERROR_CODE = "personal_organization";
export const OWNER_CANNOT_LEAVE_ERROR_CODE = "owner_cannot_leave";
export const PROJECT_ACCESS_REQUIRED_ERROR_CODE = "project_access_required";

type MemberAction = "read" | "update" | "delete";

export interface MemberRoleChange {
  role: OrganizationRole;
  projectAccess?: ProjectAccess;
}

@singleton()
export class OrganizationMemberService {
  constructor(
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    private readonly txService: TxService,
    private readonly departedMemberAlertsService: DepartedMemberAlertsService
  ) {}

  async listMembers(): Promise<OrganizationMemberWithUser[]> {
    const { organizationId } = this.#activeOrganization();

    return await this.#repositoryFor("read").findAllWithUsers(organizationId);
  }

  async updateRole(id: OrganizationMemberOutput["id"], { role, projectAccess: requestedAccess }: MemberRoleChange): Promise<OrganizationMemberWithUser> {
    const { organizationId } = this.#activeTeamOrganization();

    await this.txService.transaction(async () => {
      const owners = await this.organizationMemberRepository.lockOwners(organizationId);
      const member = await this.#findMember(id);
      this.#assertOwnerRoleUntouchedByNonOwner(owners, [member.role, role]);

      if (member.role === "owner" && role !== "owner") {
        await this.assertAnotherOwnerRemains(organizationId, member.userId);
      }

      const projectAccess = projectAccessAfterRoleChange(member, role, requestedAccess);

      if (holdsProjectGrants(role) && projectAccess === "selected") {
        await this.#assertHoldsAProjectGrant(member);
      }

      await this.#repositoryFor("update").updateById(member.id, { role, projectAccess });
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

      await this.#endMembership(this.#repositoryFor("delete"), member, organizationId);
    });
  }

  /** Needs no permission over other members, since the only membership it reads or deletes is the caller's own. */
  async leave(organizationId: string): Promise<void> {
    const context = this.#activeOrganization();
    assert(context.organizationId === organizationId, 404, "Organization not found");

    if (context.organizationType === "personal") {
      throw createError(403, "A personal organization cannot be left", { errorCode: PERSONAL_ORGANIZATION_ERROR_CODE });
    }

    await this.txService.transaction(async () => {
      await this.organizationMemberRepository.lockOwners(organizationId);
      const membership = await this.organizationMemberRepository.findOneBy({ organizationId, userId: this.authService.currentUser.id });
      assert(membership, 404, "Organization not found");

      if (membership.role === "owner") {
        throw createError(409, "Transfer ownership of the organization before leaving it", { errorCode: OWNER_CANNOT_LEAVE_ERROR_CODE });
      }

      await this.#endMembership(this.organizationMemberRepository, membership, organizationId);
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

  /** Leaving and being removed both end here, so either way the member loses the same access and alerts. */
  async #endMembership(repository: OrganizationMemberRepository, member: OrganizationMemberOutput, organizationId: string): Promise<void> {
    await repository.deleteById(member.id);
    await this.departedMemberAlertsService.stopTeamAlertsTo(member.userId, organizationId);
  }

  async #assertHoldsAProjectGrant({ organizationId, userId }: OrganizationMemberOutput): Promise<void> {
    const grants = await this.projectMemberRepository.accessibleBy(this.authService.ability, "read").findLiveGrantsOf(organizationId, userId);
    assert(grants.length > 0, 400, "A member or viewer with access to specific projects needs at least one project grant");
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

export function projectAccessRequired(message: string) {
  return createError(400, message, { errorCode: PROJECT_ACCESS_REQUIRED_ERROR_CODE });
}

/** Moving someone into member or viewer from a role that ignores project access must say how far they reach, so access is never silently widened or emptied. */
function projectAccessAfterRoleChange(member: OrganizationMemberOutput, role: OrganizationRole, requested: ProjectAccess | undefined): ProjectAccess {
  if (!holdsProjectGrants(role)) return member.projectAccess;
  if (requested) return requested;
  if (holdsProjectGrants(member.role)) return member.projectAccess;

  throw projectAccessRequired("Choose the project access of someone who becomes a member or viewer");
}

function holdsProjectGrants(role: OrganizationRole): boolean {
  return GRANT_HOLDING_ORGANIZATION_ROLES.includes(role);
}

function ownerRoleRestricted() {
  return createError(403, "Only an owner can grant, change or remove the owner role", { errorCode: OWNER_ROLE_RESTRICTED_ERROR_CODE });
}
