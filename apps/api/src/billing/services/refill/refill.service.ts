import { LoggerService } from "@akashnetwork/logging";
import { PromisePool } from "@supercharge/promise-pool";
import { singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { type UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService, WalletInitializerService } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { Semaphore } from "@src/core/lib/semaphore.decorator";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";

@singleton()
export class RefillService {
  private readonly logger = LoggerService.forContext(RefillService.name);

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly managedUserWalletService: ManagedUserWalletService,
    private readonly balancesService: BalancesService,
    private readonly walletInitializerService: WalletInitializerService,
    private readonly analyticsService: AnalyticsService,
    private readonly featureFlagsService: FeatureFlagsService
  ) {}

  async refillAllFees() {
    const isAnonymousTrialEnabled = this.featureFlagsService.isEnabled(FeatureFlags.ANONYMOUS_FREE_TRIAL);
    const wallets = await this.userWalletRepository.findDrainingWallets(
      {
        fee: this.config.FEE_ALLOWANCE_REFILL_THRESHOLD
      },
      { excludeTrialWallets: isAnonymousTrialEnabled }
    );

    if (wallets.length) {
      const { errors } = await PromisePool.withConcurrency(this.config.ALLOWANCE_REFILL_BATCH_SIZE)
        .for(wallets)
        .process(async wallet => this.refillWalletFees(wallet));

      if (errors.length) {
        this.logger.error({ event: "WALLETS_REFILL_ERROR", error: new AggregateError(errors) });
      }
    }
  }

  private async refillWalletFees(userWallet: UserWalletOutput) {
    await this.managedUserWalletService.authorizeSpending({
      address: userWallet.address!,
      limits: {
        fees: this.config.FEE_ALLOWANCE_REFILL_AMOUNT
      }
    });
    await this.balancesService.refreshUserWalletLimits(userWallet);
  }

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
    await this.managedUserWalletService.authorizeSpending({
      address: userWallet.address!,
      limits
    });

    await this.balancesService.refreshUserWalletLimits(userWallet, { endTrial: true });
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
