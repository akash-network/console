import createError from "http-errors";
import { singleton } from "tsyringe";

import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";

export const LAST_OWNER_ERROR_CODE = "last_owner";

@singleton()
export class OrganizationMemberService {
  constructor(private readonly organizationMemberRepository: OrganizationMemberRepository) {}

  /** Call it inside the transaction that demotes or removes the member, so the owner lock it takes outlives the check. */
  async assertAnotherOwnerRemains(organizationId: string, userId: string): Promise<void> {
    const owners = await this.organizationMemberRepository.lockOwners(organizationId);
    const remainingOwners = owners.filter(owner => owner.userId !== userId);

    if (remainingOwners.length === 0) {
      throw createError(409, "An organization needs at least one owner", { errorCode: LAST_OWNER_ERROR_CODE });
    }
  }
}
