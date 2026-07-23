import { createOtelLogger } from "@akashnetwork/logging/otel";
import { PromisePool } from "@supercharge/promise-pool";
import addDays from "date-fns/addDays";
import subDays from "date-fns/subDays";
import { singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { type StripeTransactionType, type UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { WalletInitializerService } from "@src/billing/services/wallet-initializer/wallet-initializer.service";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";

export interface PaymentAnalyticsContext {
  currency?: string;
  cardBrand?: string;
  paymentMethodType?: string;
  transactionId?: string;
  source?: StripeTransactionType;
  /** First-purchase bonus included in the topped-up amount, in cents. */
  bonusAmountCents?: number;
}

@singleton()
export class RefillService {
  private readonly logger = createOtelLogger({ context: RefillService.name });

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly managedUserWalletService: ManagedUserWalletService,
    private readonly managedSignerService: ManagedSignerService,
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
    const trialStartedAt = userWallet.activatedAt ?? userWallet.createdAt;
    const isInTrialWindow = userWallet.isTrialing && trialStartedAt && trialStartedAt > trialWindowStart;

    const expiration = isInTrialWindow && trialStartedAt ? addDays(trialStartedAt, this.config.TRIAL_ALLOWANCE_EXPIRATION_DAYS) : undefined;

    await this.managedUserWalletService.authorizeSpending(this.managedSignerService, {
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
   * @param options.payment - Payment context attached to the `balance_top_up` analytics event
   */
  async topUpWallet(amountUsd: number, userId: UserWalletOutput["userId"], options: { endTrial?: boolean; payment?: PaymentAnalyticsContext } = {}) {
    const userWallet = await this.getOrCreateUserWallet(userId);
    const currentLimit = await this.balancesService.retrieveDeploymentLimit(userWallet);

    const nextLimit = currentLimit + amountUsd * 10000;
    const limits = { deployment: nextLimit, fees: this.config.FEE_ALLOWANCE_REFILL_AMOUNT };
    await this.managedUserWalletService.authorizeSpending(this.managedSignerService, {
      address: userWallet.address!,
      limits
    });

    await this.balancesService.refreshUserWalletLimits(userWallet, { endTrial: options.endTrial ?? true });
    this.analyticsService.track(userId, "balance_top_up", {
      amount_cents: amountUsd,
      amount_usd: amountUsd / 100,
      currency: options.payment?.currency,
      card_brand: options.payment?.cardBrand,
      payment_method_type: options.payment?.paymentMethodType,
      transaction_id: options.payment?.transactionId,
      source: options.payment?.source,
      bonus_amount_cents: options.payment?.bonusAmountCents
    });
    this.logger.debug({ event: "WALLET_TOP_UP", userWallet, limits });
  }

  /**
   * Reduce the wallet balance (e.g., for refunds)
   * @param amountUsd - The amount in USD *cents* to reduce from the wallet (e.g. 10000 = $100)
   * @param userId - The ID of the user to reduce the wallet for
   * @param payment - Payment context attached to the `balance_refund` analytics event
   */
  async reduceWalletBalance(amountUsd: number, userId: UserWalletOutput["userId"], payment?: Pick<PaymentAnalyticsContext, "currency" | "transactionId">) {
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

    await this.managedUserWalletService.authorizeSpending(this.managedSignerService, {
      address: userWallet.address,
      limits
    });

    await this.balancesService.refreshUserWalletLimits(userWallet);
    this.analyticsService.track(userId, "balance_refund", {
      amount_cents: amountUsd,
      amount_usd: amountUsd / 100,
      currency: payment?.currency,
      transaction_id: payment?.transactionId
    });
    this.logger.info({ event: "WALLET_BALANCE_REDUCED", userId, amountUsd, previousLimit: currentLimit, nextLimit });
  }

  /**
   * Funding a wallet with real money activates it even when the user never started a trial,
   * so `claimActivation` is attempted on every top-up and silently no-ops for already-activated wallets.
   */
  private async getOrCreateUserWallet(userId: UserWalletOutput["userId"]) {
    const userWallet = await this.walletInitializerService.ensureWallet(userId);

    return (await this.userWalletRepository.claimActivation(userWallet.id)) ?? userWallet;
  }
}
