import { PromisePool } from "@supercharge/promise-pool";
import { inject, singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { type StripeTransactionType, type UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { WalletInitializerService } from "@src/billing/services/wallet-initializer/wallet-initializer.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { type OrganizationOutput, OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";

export interface PaymentAnalyticsContext {
  currency?: string;
  cardBrand?: string;
  paymentMethodType?: string;
  transactionId?: string;
  source?: StripeTransactionType;
  isAutoRecharge?: boolean;
  /** First-purchase bonus included in the topped-up amount, in cents. */
  bonusAmountCents?: number;
}

/** Who a credit or a debit is for: the member who acted and the organization that paid. */
export interface WalletPayer {
  userId: string;
  organizationId?: string | null;
}

/** Identifiers of the wallet a top-up credited, so callers can fund its draining deployments once the credit has committed. */
export interface ToppedUpWallet {
  walletId: number;
  address: string;
}

@singleton()
export class RefillService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly managedUserWalletService: ManagedUserWalletService,
    private readonly managedSignerService: ManagedSignerService,
    private readonly balancesService: BalancesService,
    private readonly walletInitializerService: WalletInitializerService,
    private readonly analyticsService: AnalyticsService,
    private readonly organizationRepository: OrganizationRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: RefillService.name });
  }

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
    await this.managedUserWalletService.refillWalletFees(this.managedSignerService, userWallet);
    await this.balancesService.refreshUserWalletLimits(userWallet);
  }

  /**
   * Top up the wallet with the given amount in USD
   * @param amountUsd - The amount in USD *cents* to top up the wallet with (e.g. 10000 = $100)
   * @param payer - The member who paid and the organization paying, read off the transaction
   * @param options.payment - Payment context attached to the `balance_top_up` analytics event
   * @returns The credited wallet's identifiers, so the caller can fund its draining deployments after the credit commits.
   */
  async topUpWallet(amountUsd: number, payer: WalletPayer, options: { endTrial?: boolean; payment?: PaymentAnalyticsContext } = {}): Promise<ToppedUpWallet> {
    const { userId } = payer;
    const userWallet = await this.lockActivatedWallet(payer);
    const currentLimit = await this.balancesService.retrieveDeploymentLimit(userWallet);

    const nextLimit = currentLimit + amountUsd * 10000;
    const limits = { deployment: nextLimit, fees: this.config.FEE_ALLOWANCE_REFILL_AMOUNT };
    await this.managedUserWalletService.authorizeSpending(this.managedSignerService, {
      address: userWallet.address!,
      limits
    });

    await this.balancesService.refreshUserWalletLimits(userWallet, { endTrial: options.endTrial ?? true });
    await this.clearAbuseLockOnPayment(userWallet, userId);

    this.analyticsService.track(userId, "balance_top_up", {
      amount_cents: amountUsd,
      amount_usd: amountUsd / 100,
      currency: options.payment?.currency,
      card_brand: options.payment?.cardBrand,
      payment_method_type: options.payment?.paymentMethodType,
      transaction_id: options.payment?.transactionId,
      source: options.payment?.source,
      auto_recharge: options.payment?.isAutoRecharge,
      bonus_amount_cents: options.payment?.bonusAmountCents
    });
    this.logger.debug({ event: "WALLET_TOP_UP", userWallet, limits });

    return { walletId: userWallet.id, address: userWallet.address! };
  }

  /**
   * Reduce the wallet balance (e.g., for refunds)
   * @param amountUsd - The amount in USD *cents* to reduce from the wallet (e.g. 10000 = $100)
   * @param payer - The member who paid and the organization that paid, read off the transaction
   * @param payment - Payment context attached to the `balance_refund` analytics event
   */
  async reduceWalletBalance(amountUsd: number, payer: WalletPayer, payment?: Pick<PaymentAnalyticsContext, "currency" | "transactionId">) {
    const { userId } = payer;
    const team = await this.#teamOf(payer);
    const userWallet = team ? await this.userWalletRepository.findOneByOrganizationId(team.id) : await this.userWalletRepository.findOneBy({ userId });

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

  /** A failed clear is logged instead of thrown: authorizeSpending has already raised the on-chain allowance, so rolling the settlement back would let a webhook retry credit the same charge twice. */
  private async clearAbuseLockOnPayment(userWallet: UserWalletOutput, userId: string) {
    try {
      if (!(await this.userWalletRepository.clearAbuseLock(userWallet.id))) return;

      this.logger.info({ event: "WALLET_ABUSE_LOCK_CLEARED", walletId: userWallet.id, userId });
      this.analyticsService.track(userId, "account_restriction_lifted", { lifted_by: "payment" });
    } catch (error) {
      this.logger.error({ event: "WALLET_ABUSE_LOCK_CLEAR_FAILED", walletId: userWallet.id, userId, error });
    }
  }

  /** Holds the wallet row until the settlement commits, so an abuse wipe of the same wallet waits for it instead of revoking between this grant and its bookkeeping. */
  private async lockActivatedWallet(payer: WalletPayer) {
    const userWallet = await this.ensureActivatedWallet(payer);

    return (await this.userWalletRepository.findOneByAndLock({ id: userWallet.id })) ?? userWallet;
  }

  /**
   * Returns the user's wallet, creating and activating it as needed —
   * funding with real money must activate a wallet even when the user never started a trial.
   * The activation claim no-ops for already-activated wallets.
   */
  private async ensureActivatedWallet(payer: WalletPayer) {
    const team = await this.#teamOf(payer);
    const userWallet = team
      ? await this.walletInitializerService.ensureTeamWallet(team, payer.userId)
      : await this.walletInitializerService.ensureWallet(payer.userId);

    return (await this.userWalletRepository.claimActivation(userWallet.id)) ?? userWallet;
  }

  /** A team organization pays into its own wallet; any other payment funds the wallet of the user who made it. */
  async #teamOf(payer: WalletPayer): Promise<OrganizationOutput | undefined> {
    if (!payer.organizationId) return undefined;

    const organization = await this.organizationRepository.findById(payer.organizationId);

    return organization?.type === "team" ? organization : undefined;
  }
}
