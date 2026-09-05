import { createMongoAbility } from "@casl/ability";
import { addMilliseconds, millisecondsInHour, millisecondsInMinute, millisecondsInSecond } from "date-fns";
import createError from "http-errors";
import { Err, Ok, Result } from "ts-results";
import { singleton } from "tsyringe";

import { AUTO_RELOAD_AMOUNT_MIN_USD } from "@src/billing/config";
import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import type { GetBalancesResponseOutput } from "@src/billing/http-schemas/balance.schema";
import type { PaymentIntentResult } from "@src/billing/http-schemas/stripe.schema";
import { AUTHENTICATION_REQUIRED_DECLINE_CODE, CARD_DECLINED_ERROR_CODE, type CardDecline, toCardDecline } from "@src/billing/lib/card-decline/card-decline";
import { centsToUsd } from "@src/billing/lib/currency/currency";
import { type ChargeClaim, UserWalletOutput, WalletSettingOutput, WalletSettingRepository } from "@src/billing/repositories";
import { AutoReloadPauseService } from "@src/billing/services/auto-reload-pause/auto-reload-pause.service";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { type PaymentMethod, PaymentMethodService } from "@src/billing/services/payment-method/payment-method.service";
import { AUTO_RECHARGE_METADATA_KEY, StripeTransactionService } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { JobHandler, JobMeta, JobPayload } from "@src/core";
import type { Require } from "@src/core/types/require.type";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { isPayingUser, PayingUser } from "../paying-user/paying-user";
import { WalletBalanceReloadCheckInstrumentationService } from "./wallet-balance-reload-check-instrumentation.service";

type ValidationError = {
  event: string;
  message: string;
};

type InitializedWallet = Require<Pick<UserWalletOutput, "address">, "address">;
type ActionableWalletSetting = Pick<
  WalletSettingOutput,
  "id" | "userId" | "autoReloadMode" | "autoReloadThreshold" | "autoReloadAmount" | "autoReloadFailureCount"
>;

type Resources = {
  walletSetting: ActionableWalletSetting;
  wallet: InitializedWallet;
  user: PayingUser;
};
type AllResources = Resources & { balance: GetBalancesResponseOutput["data"]["total"]; paymentMethod: PaymentMethod };
type ReloadContext = AllResources & { job: JobMeta; triggeredByDeployment: boolean };
type ReloadOutcome = { nextCheckAt: Date } | undefined;

const millisecondsInDay = 24 * millisecondsInHour;

const AUTHENTICATION_REQUIRED_MESSAGE = "The card requires authentication, which an automatic charge cannot provide.";

@singleton()
export class WalletBalanceReloadCheckHandler implements JobHandler<WalletBalanceReloadCheck> {
  public readonly accepts = WalletBalanceReloadCheck;

  public readonly concurrency = 2;

  public readonly policy = "singleton";

  #CHECK_INTERVAL_IN_MS = millisecondsInDay;

  #RELOAD_COVERAGE_PERIOD_IN_MS = 7 * millisecondsInDay;

  #MIN_COVERAGE_PERCENTAGE = 0.25;

  #MIN_RELOAD_AMOUNT_IN_USD = 20;

  /** Scheduling the deferred check slightly past the window reopen avoids a boundary re-skip. */
  #CHARGE_WINDOW_REOPEN_BUFFER_IN_MS = millisecondsInMinute;

  constructor(
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly balancesService: BalancesService,
    private readonly walletReloadJobService: WalletReloadJobService,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly stripeTransactionService: StripeTransactionService,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly instrumentationService: WalletBalanceReloadCheckInstrumentationService,
    private readonly autoReloadPauseService: AutoReloadPauseService
  ) {}

  async handle(payload: JobPayload<WalletBalanceReloadCheck>, job: JobMeta): Promise<void> {
    const startTime = Date.now();
    let success = false;

    try {
      const resourcesResult = await this.#collectResources(payload);

      if (resourcesResult.ok) {
        const reloadOutcome = await this.#tryToReload({ ...resourcesResult.val, job, triggeredByDeployment: payload.triggeredByDeployment ?? false });
        await this.#scheduleNextCheck(resourcesResult.val, reloadOutcome?.nextCheckAt);
        success = true;
      } else {
        this.instrumentationService.recordValidationError(resourcesResult.val.event, resourcesResult.val, payload.userId);
        success = true;
        return;
      }
    } finally {
      const durationMs = Date.now() - startTime;
      this.instrumentationService.recordJobExecution(durationMs, success, payload.userId);
    }
  }

  async #collectResources(job: JobPayload<WalletBalanceReloadCheck>): Promise<Result<AllResources, ValidationError>> {
    const walletResult = await this.#getValidWalletResources(job.userId);

    if (!walletResult.ok) {
      return walletResult;
    }

    const { wallet, user } = walletResult.val;

    const paymentMethod = await this.#getDefaultPaymentMethod(user);

    if (!paymentMethod.ok) {
      return paymentMethod;
    }

    const balance = await this.balancesService.getDeploymentBalanceInFiat(wallet.address);

    return Ok({ ...walletResult.val, paymentMethod: paymentMethod.val, balance });
  }

  async #getValidWalletResources(userId: JobPayload<WalletBalanceReloadCheck>["userId"]): Promise<Result<Resources, ValidationError>> {
    const walletSettingWithWallet = await this.walletSettingRepository.findInternalByUserIdWithRelations(userId);

    if (!walletSettingWithWallet) {
      return Err({
        event: "WALLET_SETTING_NOT_FOUND",
        message: "Wallet setting not found. Skipping wallet balance reload check."
      });
    }

    const { wallet, user, ...walletSetting } = walletSettingWithWallet;

    if (!walletSetting.autoReloadEnabled) {
      return Err({
        event: "AUTO_RELOAD_DISABLED",
        message: "Auto reload disabled. Skipping wallet balance reload check."
      });
    }

    if (walletSetting.autoReloadPausedAt) {
      return Err({
        event: "AUTO_RELOAD_PAUSED",
        message: "Auto reload paused after repeated card declines. Skipping wallet balance reload check."
      });
    }

    const { address } = wallet;

    if (!address) {
      return Err({
        event: "WALLET_NOT_INITIALIZED",
        message: "Wallet not initialized. Skipping wallet balance reload check."
      });
    }

    if (!isPayingUser(user)) {
      return Err({
        event: "USER_STRIPE_CUSTOMER_ID_NOT_SET",
        message: "User stripe customer ID not set. Skipping wallet balance reload check."
      });
    }

    return Ok({
      walletSetting: {
        ...walletSetting,
        userId: user.id
      },
      wallet: { ...wallet, address },
      user
    });
  }

  async #getDefaultPaymentMethod(user: PayingUser): Promise<Result<PaymentMethod, ValidationError>> {
    const paymentMethod = await this.paymentMethodService.getDefaultPaymentMethod(
      user,
      createMongoAbility([
        {
          action: "read",
          subject: "PaymentMethod"
        }
      ])
    );

    if (paymentMethod) {
      return Ok(paymentMethod);
    }

    return Err({
      event: "DEFAULT_PAYMENT_METHOD_NOT_FOUND",
      message: "Default payment method not found"
    });
  }

  async #tryToReload(resources: ReloadContext): Promise<ReloadOutcome> {
    if (resources.walletSetting.autoReloadMode === "threshold") {
      return this.#tryToReloadOnFixedThreshold(resources);
    }

    return this.#tryToReloadOnPredictedSpend(resources);
  }

  async #tryToReloadOnFixedThreshold(resources: ReloadContext): Promise<ReloadOutcome> {
    const { balance } = resources;
    const mode = resources.walletSetting.autoReloadMode;
    const threshold = centsToUsd(resources.walletSetting.autoReloadThreshold);
    const reloadAmount = Math.max(centsToUsd(resources.walletSetting.autoReloadAmount), AUTO_RELOAD_AMOUNT_MIN_USD);
    const log = {
      walletAddress: resources.wallet.address,
      balance,
      threshold,
      reloadAmount
    };
    const coverageRatio = threshold > 0 ? balance / threshold : undefined;

    if (balance > threshold) {
      this.instrumentationService.recordReloadSkipped({ mode, reason: "sufficient_balance", coverageRatio, logContext: log });
      return;
    }

    if (!resources.triggeredByDeployment) {
      const activeDeploymentCount = await this.deploymentRepository.countActiveByOwner(resources.wallet.address);
      if (activeDeploymentCount === 0) {
        this.instrumentationService.recordReloadSkipped({ mode, reason: "no_active_deployments", coverageRatio, logContext: log });
        return;
      }
    }

    return this.#chargeWithinRateLimit({ resources, amount: reloadAmount, coverageRatio, logContext: log });
  }

  async #tryToReloadOnPredictedSpend(resources: ReloadContext): Promise<ReloadOutcome> {
    const mode = resources.walletSetting.autoReloadMode;
    const reloadTargetDate = addMilliseconds(new Date(), this.#RELOAD_COVERAGE_PERIOD_IN_MS);
    const costUntilTargetDateInDenom = await this.drainingDeploymentService.calculateAllDeploymentCostUntilDate(resources.wallet.address, reloadTargetDate);
    const costUntilTargetDateInFiat = await this.balancesService.toFiatAmount(costUntilTargetDateInDenom);
    const threshold = this.balancesService.ensure2floatingDigits(this.#MIN_COVERAGE_PERCENTAGE * costUntilTargetDateInFiat);
    const log = {
      walletAddress: resources.wallet.address,
      balance: resources.balance,
      costUntilTargetDateInFiat,
      threshold
    };
    const coverageRatio = costUntilTargetDateInFiat > 0 ? resources.balance / costUntilTargetDateInFiat : undefined;

    if (costUntilTargetDateInFiat === 0) {
      this.instrumentationService.recordReloadSkipped({ mode, reason: "zero_cost", coverageRatio, projectedCost: costUntilTargetDateInFiat, logContext: log });
      return;
    }

    if (resources.balance >= threshold) {
      this.instrumentationService.recordReloadSkipped({
        mode,
        reason: "sufficient_balance",
        coverageRatio,
        projectedCost: costUntilTargetDateInFiat,
        logContext: log
      });
      return;
    }

    const reloadAmountInFiat = Math.max(costUntilTargetDateInFiat - resources.balance, this.#MIN_RELOAD_AMOUNT_IN_USD);

    return this.#chargeWithinRateLimit({
      resources,
      amount: reloadAmountInFiat,
      coverageRatio,
      projectedCost: costUntilTargetDateInFiat,
      logContext: log
    });
  }

  /** A failed charge keeps the claim, so a declining card re-attempts when the window reopens instead of on every spend event (CON-927). */
  async #chargeWithinRateLimit(input: {
    resources: ReloadContext;
    amount: number;
    coverageRatio: number | undefined;
    projectedCost?: number;
    logContext: Record<string, unknown>;
  }): Promise<ReloadOutcome> {
    const { resources, amount, coverageRatio, projectedCost, logContext } = input;
    const mode = resources.walletSetting.autoReloadMode;
    const cooldownMinutes = this.autoReloadPauseService.calculateChargeCooldownMinutes(resources.walletSetting.autoReloadFailureCount);
    const attempt = await this.walletSettingRepository.claimForCharge(resources.walletSetting.id, cooldownMinutes);

    if (!attempt.won) {
      const nextCheckAt = this.#calculateChargeWindowReopenDate(attempt.secondsUntilWindowReopen);
      this.instrumentationService.recordReloadSkipped({
        mode,
        reason: "charge_rate_limited",
        coverageRatio,
        projectedCost,
        logContext: { ...logContext, nextCheckAt }
      });
      return { nextCheckAt };
    }

    try {
      const result = await this.stripeTransactionService.createPaymentIntent({
        userId: resources.user.id,
        customer: resources.user.stripeCustomerId,
        payment_method: resources.paymentMethod.id,
        amount,
        confirm: true,
        offSession: true,
        metadata: { [AUTO_RECHARGE_METADATA_KEY]: "true" },
        idempotencyKey: `${WalletBalanceReloadCheck.name}.${resources.job.id}`,
        onAmountMismatch: "tolerate"
      });

      if (result.requiresAction) {
        throw await this.#abandonUnauthenticatedCharge(result);
      }

      if (result.success) {
        await this.walletSettingRepository.resetChargeFailures(resources.walletSetting.id);
      }

      this.instrumentationService.recordReloadTriggered({ mode, amount, coverageRatio, projectedCost, logContext });
    } catch (error) {
      const decline = toCardDecline(error);
      this.instrumentationService.recordReloadFailed({ mode, error, declineCode: decline?.declineCode, logContext });

      if (decline) {
        await this.#recordDecline(attempt.claim, resources, decline);
      }

      throw error;
    }
  }

  /** Stripe is asked to decline these outright, so one that still stalls on authentication is cancelled and reported as the decline it amounts to. */
  async #abandonUnauthenticatedCharge(result: PaymentIntentResult): Promise<Error> {
    if (result.paymentIntentId) {
      await this.stripeTransactionService.cancelUnauthenticatedPaymentIntent(result.paymentIntentId);
    }

    return createError(402, AUTHENTICATION_REQUIRED_MESSAGE, {
      errorCode: CARD_DECLINED_ERROR_CODE,
      errorType: "payment_error",
      declineCode: AUTHENTICATION_REQUIRED_DECLINE_CODE
    });
  }

  /**
   * Best-effort: a rejected pause must not replace the payment error the caller is about to record
   * and rethrow, which retries and alerting classify. The counter is what keeps a pause that keeps
   * failing from making the whole give-up rule quietly inert.
   */
  async #recordDecline(claim: ChargeClaim, resources: ReloadContext, decline: CardDecline): Promise<void> {
    try {
      await this.autoReloadPauseService.recordDecline({ claim, user: resources.user, decline });
    } catch (error) {
      this.instrumentationService.recordDeclineRecordingError(resources.user.id, error);
    }
  }

  async #scheduleNextCheck(resources: Resources, nextCheckAt?: Date): Promise<void> {
    const defaultNextCheckDate = this.#calculateNextCheckDate();
    const startAfter = nextCheckAt && nextCheckAt < defaultNextCheckDate ? nextCheckAt : defaultNextCheckDate;

    try {
      await this.walletReloadJobService.scheduleForWalletSetting(resources.walletSetting, {
        startAfter: startAfter.toISOString(),
        withCleanup: true
      });
    } catch (error) {
      this.instrumentationService.recordSchedulingError(resources.wallet.address, error);
      throw error;
    }
  }

  /**
   * Defers by the cooldown still owed rather than a fresh full one: a check that loses the claim
   * late in the window would otherwise wait out nearly two cooldowns before retrying.
   */
  #calculateChargeWindowReopenDate(secondsUntilWindowReopen: number): Date {
    return addMilliseconds(new Date(), secondsUntilWindowReopen * millisecondsInSecond + this.#CHARGE_WINDOW_REOPEN_BUFFER_IN_MS);
  }

  #calculateNextCheckDate(): Date {
    return addMilliseconds(new Date(), this.#CHECK_INTERVAL_IN_MS);
  }
}
