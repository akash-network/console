import { LoggerService } from "@akashnetwork/logging";
import { PromisePool } from "@supercharge/promise-pool";
import addDays from "date-fns/addDays";
import subDays from "date-fns/subDays";
import { singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { type UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
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
    private readonly balancesService: BalancesService,
    private readonly walletInitializerService: WalletInitializerService,
    private readonly analyticsService: AnalyticsService
  ) {}

  async refillAllFees() {
    const wallets = await this.userWalletRepository.findDrainingWallets({
      fee: this.config.FEE_ALLOWANCE_REFILL_THRESHOLD,
      trialExpirationDays: this.config.TRIAL_ALLOWANCE_EXPIRATION_DAYS
    });

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
    const trialWindowStart = subDays(new Date(), this.config.TRIAL_ALLOWANCE_EXPIRATION_DAYS);
    const isInTrialWindow = userWallet.isTrialing && userWallet.createdAt && userWallet.createdAt > trialWindowStart;

    const expiration = isInTrialWindow && userWallet.createdAt ? addDays(userWallet.createdAt, this.config.TRIAL_ALLOWANCE_EXPIRATION_DAYS) : undefined;

    await this.managedUserWalletService.authorizeSpending({
      address: userWallet.address!,
      limits: {
        fees: this.config.FEE_ALLOWANCE_REFILL_AMOUNT
      },
      expiration
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

  /**
   * Reduce the wallet balance (e.g., for refunds)
   * @param amountUsd - The amount in USD *cents* to reduce from the wallet (e.g. 10000 = $100)
   * @param userId - The ID of the user to reduce the wallet for
   */
  async reduceWalletBalance(amountUsd: number, userId: UserWalletOutput["userId"]) {
    const userWallet = await this.userWalletRepository.findOneBy({ userId });

    if (!userWallet || !userWallet.address) {
      this.logger.warn({ event: "WALLET_REDUCE_NO_WALLET", userId });
      return;
    }

    const currentLimit = await this.balancesService.retrieveDeploymentLimit(userWallet);
    const reductionAmount = amountUsd * 10000;

    // Ensure we don't go below 0
    const nextLimit = Math.max(0, currentLimit - reductionAmount);
    const limits = { deployment: nextLimit, fees: this.config.FEE_ALLOWANCE_REFILL_AMOUNT };

    await this.managedUserWalletService.authorizeSpending(
      {
        address: userWallet.address,
        limits
      },
      userWallet.isOldWallet ?? false
    );

    await this.balancesService.refreshUserWalletLimits(userWallet);
    this.analyticsService.track(userId!, "balance_refund");
    this.logger.info({ event: "WALLET_BALANCE_REDUCED", userId, amountUsd, previousLimit: currentLimit, nextLimit });
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
