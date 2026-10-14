import { singleton } from "tsyringe";

import { PaymentMethodRepository, StripeTransactionRepository, WalletSettingRepository } from "@src/billing/repositories";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";

/** Keeps what a member wrote for team organizations with those teams once the member's account is deleted, naming no member on it. */
@singleton()
export class TeamRecordRetentionService {
  constructor(
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository
  ) {}

  /** Run it in the transaction that deletes the user row, before that delete cascades to whatever still names the member. */
  async releaseFromTeams(userId: string): Promise<void> {
    await this.stripeTransactionRepository.detachFromTeams(userId);
    await this.paymentMethodRepository.detachFromTeams(userId);
    await this.walletSettingRepository.detachFromTeams(userId);
    await this.deploymentSettingRepository.detachFromTeams(userId);
  }
}
