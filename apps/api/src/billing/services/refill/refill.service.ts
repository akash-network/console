import { PromisePool } from "@supercharge/promise-pool";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService, WalletInitializerService } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { LoggerService } from "@src/core";
import { InjectSentry, Sentry } from "@src/core/providers/sentry.provider";
import { SentryEventService } from "@src/core/services/sentry-event/sentry-event.service";

@singleton()
export class RefillService {
  private readonly logger = LoggerService.forContext(RefillService.name);

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly managedUserWalletService: ManagedUserWalletService,
    private readonly balancesService: BalancesService,
    private readonly walletInitializerService: WalletInitializerService,
    @InjectSentry() private readonly sentry: Sentry,
    private readonly sentryEventService: SentryEventService
  ) {}

  async refillAllFees() {
    const wallets = await this.userWalletRepository.findDrainingWallets({
      fee: this.config.FEE_ALLOWANCE_REFILL_THRESHOLD
    });

    if (wallets.length) {
      const { errors } = await PromisePool.withConcurrency(this.config.ALLOWANCE_REFILL_BATCH_SIZE)
        .for(wallets)
        .process(async wallet => this.refillWalletFees(wallet));

      if (errors.length) {
        const id = this.sentry.captureEvent(this.sentryEventService.toEvent(errors));
        this.logger.error({ event: "WALLETS_REFILL_ERROR", errors, sentryEventId: id });
      }
    }
  }

  private async refillWalletFees(userWallet: UserWalletOutput) {
    await this.managedUserWalletService.authorizeSpending({
      address: userWallet.address,
      limits: {
        fees: this.config.FEE_ALLOWANCE_REFILL_AMOUNT
      }
    });
    await this.balancesService.refreshUserWalletLimits(userWallet);
  }

  async topUpWallet(amountUsd: number, userId: UserWalletOutput["userId"]) {
    let userWallet = await this.userWalletRepository.findOneBy({ userId });
    let currentLimit: number = 0;

    if (userWallet) {
      currentLimit = await this.balancesService.retrieveAndCalcDeploymentLimit(userWallet);
    } else {
      userWallet = await this.walletInitializerService.initialize(userId);
    }

    const nextLimit = currentLimit + amountUsd * 10000;
    const limits = { deployment: nextLimit, fees: this.config.FEE_ALLOWANCE_REFILL_AMOUNT };
    await this.managedUserWalletService.authorizeSpending({
      address: userWallet.address,
      limits
    });

    await this.balancesService.refreshUserWalletLimits(userWallet, { endTrial: true });
    this.logger.debug({ event: "WALLET_TOP_UP", limits });
  }
}
