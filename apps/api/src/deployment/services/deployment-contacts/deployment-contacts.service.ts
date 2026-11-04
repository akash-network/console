import { singleton } from "tsyringe";

import type { UserWalletOutput } from "@src/billing/repositories";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { type UserOutput, UserRepository } from "@src/user/repositories";

@singleton()
export class DeploymentContactsService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository
  ) {}

  /** A team deployment's filer hears about it only while still a member of the team, and its owners do once the filer is gone. */
  async findFor({ wallet, filingUserId }: { wallet: Pick<UserWalletOutput, "userId" | "organizationId">; filingUserId: string }): Promise<UserOutput[]> {
    if (wallet.userId || !wallet.organizationId) {
      const user = await this.userRepository.findById(filingUserId);
      return user ? [user] : [];
    }

    const filer = await this.organizationMemberRepository.findMemberUser(wallet.organizationId, filingUserId);

    return filer ? [filer] : await this.organizationMemberRepository.findOwners(wallet.organizationId);
  }
}
