import { singleton } from "tsyringe";

import { PaymentMethodRepository, StripeTransactionRepository, WalletSettingRepository } from "@src/billing/repositories";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { UserOutput } from "@src/user/repositories/user/user.repository";
import { UserTemplateRepository } from "@src/user/repositories/user-template/user-template.repository";

/** Keeps what a member wrote for team organizations with those teams once the member's account is deleted, naming no member on it. */
@singleton()
export class TeamRecordRetentionService {
  constructor(
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly userTemplateRepository: UserTemplateRepository
  ) {}

  /** Run it in the transaction that deletes the user row and the user's templates, before either removes whatever still names the member. */
  async releaseFromTeams(user: Pick<UserOutput, "id" | "userId">): Promise<void> {
    await this.stripeTransactionRepository.detachFromTeams(user.id);
    await this.paymentMethodRepository.detachFromTeams(user.id);
    await this.walletSettingRepository.detachFromTeams(user.id);
    await this.deploymentSettingRepository.detachFromTeams(user.id);
    if (user.userId) await this.userTemplateRepository.detachFromTeams(user.userId);
  }
}
