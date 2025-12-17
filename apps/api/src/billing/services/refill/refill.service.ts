import { LoggerService } from "@akashnetwork/logging";
import { singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { type UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { WalletInitializerService } from "@src/billing/services/wallet-initializer/wallet-initializer.service";
import { Semaphore } from "@src/core/lib/semaphore.decorator";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";

@singleton()
export class RefillService {
  private readonly logger = LoggerService.forContext(RefillService.name);

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly managedUserWalletService: ManagedUserWalletService,
    private readonly managedSignerService: ManagedSignerService,
    private readonly balancesService: BalancesService,
    private readonly walletInitializerService: WalletInitializerService,
    private readonly analyticsService: AnalyticsService
  ) {}

  /**
   * Top up the wallet with the given amount in USD
   * @param amountUsd - The amount in USD *cents* to top up the wallet with (e.g. 10000 = $100)
   * @param userId - The ID of the user to top up the wallet for
   */
  async topUpWallet(amountUsd: number, userId: UserWalletOutput["userId"]) {
    const userWallet = await this.getOrCreateUserWallet(userId);
    const currentLimit = await this.balancesService.retrieveDeploymentLimit(userWallet);

    const nextLimit = currentLimit + amountUsd * 10000;
    const limits = { deployment: nextLimit, fees: this.config.FEE_ALLOWANCE_REFILL_AMOUNT };
    await this.managedUserWalletService.authorizeSpending(
      this.managedSignerService,
      {
        address: userWallet.address!,
        limits
      },
      userWallet.isOldWallet ?? false
    );

    await this.userWalletRepository.updateById(userWallet.id, { isTrialing: true });
    this.analyticsService.track(userId!, "balance_top_up");
    this.logger.debug({ event: "WALLET_TOP_UP", userWallet, limits });
  }

  @Semaphore()
  private async getOrCreateUserWallet(userId: UserWalletOutput["userId"]) {
    const userWallet = await this.userWalletRepository.findOneBy({ userId });
    if (userWallet) {
      return userWallet;
    }

    return await this.walletInitializerService.initialize(userId);
  }
}
