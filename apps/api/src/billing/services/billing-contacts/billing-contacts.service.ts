import { singleton } from "tsyringe";

import type { UserWalletOutput } from "@src/billing/repositories";
import type { Payer } from "@src/billing/services/payer/payer";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { type UserOutput, UserRepository } from "@src/user/repositories";

@singleton()
export class BillingContactsService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository
  ) {}

  async findForPayer(payer: Pick<Payer, "user" | "team">): Promise<UserOutput[]> {
    return payer.team ? await this.organizationMemberRepository.findBillingContacts(payer.team.id) : [payer.user];
  }

  /** A personal wallet's user hears about its billing; a team wallet's owners and billing members do. */
  async findForWallet(wallet: Pick<UserWalletOutput, "userId" | "organizationId">): Promise<UserOutput[]> {
    if (wallet.userId) {
      const user = await this.userRepository.findById(wallet.userId);
      return user ? [user] : [];
    }

    return wallet.organizationId ? await this.organizationMemberRepository.findBillingContacts(wallet.organizationId) : [];
  }
}
