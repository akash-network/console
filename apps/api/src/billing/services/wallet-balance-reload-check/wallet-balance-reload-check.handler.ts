import { createMongoAbility } from "@casl/ability";
import { addMilliseconds, millisecondsInHour } from "date-fns";
import { Err, Ok, Result } from "ts-results";
import { singleton } from "tsyringe";

import { STANDARD_TOP_UP_MIN_AMOUNT_USD } from "@src/billing/config";
import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import type { GetBalancesResponseOutput } from "@src/billing/http-schemas/balance.schema";
import { centsToUsd } from "@src/billing/lib/currency/currency";
import { UserWalletOutput, WalletSettingOutput, WalletSettingRepository } from "@src/billing/repositories";
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
type ActionableWalletSetting = Pick<WalletSettingOutput, "id" | "userId" | "autoReloadMode" | "autoReloadThreshold" | "autoReloadAmount">;

type Resources = {
  walletSetting: ActionableWalletSetting;
  wallet: InitializedWallet;
  user: PayingUser;
};
type AllResources = Resources & { balance: GetBalancesResponseOutput["data"]["total"]; paymentMethod: PaymentMethod };
type ReloadContext = AllResources & { job: JobMeta; triggeredByDeployment: boolean };

const millisecondsInDay = 24 * millisecondsInHour;

@singleton()
export class WalletBalanceReloadCheckHandler implements JobHandler<WalletBalanceReloadCheck> {
  public readonly accepts = WalletBalanceReloadCheck;

  public readonly concurrency = 2;

  public readonly policy = "singleton";

  #CHECK_INTERVAL_IN_MS = millisecondsInDay;

  #RELOAD_COVERAGE_PERIOD_IN_MS = 7 * millisecondsInDay;

  #MIN_COVERAGE_PERCENTAGE = 0.25;

  #MIN_RELOAD_AMOUNT_IN_USD = 20;

  constructor(
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly balancesService: BalancesService,
    private readonly walletReloadJobService: WalletReloadJobService,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly stripeTransactionService: StripeTransactionService,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly instrumentationService: WalletBalanceReloadCheckInstrumentationService
  ) {}

  async handle(payload: JobPayload<WalletBalanceReloadCheck>, job: JobMeta): Promise<void> {
    const startTime = Date.now();
    let success = false;

    try {
      const resourcesResult = await this.#collectResources(payload);

      if (resourcesResult.ok) {
        await this.#tryToReload({ ...resourcesResult.val, job, triggeredByDeployment: payload.triggeredByDeployment ?? false });
        await this.#scheduleNextCheck(resourcesResult.val);
        success = true;
      } else {
        this.instrumentationService.recordValidationError(resourcesResult.val.event, resourcesResult.val, payload.userId);
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

  async #tryToReload(resources: ReloadContext): Promise<void> {
    if (resources.walletSetting.autoReloadMode === "threshold") {
      return this.#tryToReloadOnFixedThreshold(resources);
    }

    return this.#tryToReloadOnPredictedSpend(resources);
  }

  async #tryToReloadOnFixedThreshold(resources: ReloadContext): Promise<void> {
    const { balance } = resources;
    const mode = resources.walletSetting.autoReloadMode;
    const threshold = centsToUsd(resources.walletSetting.autoReloadThreshold);
    const reloadAmount = Math.max(centsToUsd(resources.walletSetting.autoReloadAmount), STANDARD_TOP_UP_MIN_AMOUNT_USD);
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

    try {
      await this.stripeTransactionService.createPaymentIntent({
        userId: resources.user.id,
        customer: resources.user.stripeCustomerId,
        payment_method: resources.paymentMethod.id,
        amount: reloadAmount,
        confirm: true,
        metadata: { [AUTO_RECHARGE_METADATA_KEY]: "true" },
        idempotencyKey: `${WalletBalanceReloadCheck.name}.${resources.job.id}`,
        onAmountMismatch: "tolerate"
      });
      this.instrumentationService.recordReloadTriggered({ mode, amount: reloadAmount, coverageRatio, logContext: log });
    } catch (error) {
      this.instrumentationService.recordReloadFailed({ mode, error, logContext: log });
      throw error;
    }
  }

  async #tryToReloadOnPredictedSpend(resources: ReloadContext): Promise<void> {
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

    try {
      await this.stripeTransactionService.createPaymentIntent({
        userId: resources.user.id,
        customer: resources.user.stripeCustomerId,
        payment_method: resources.paymentMethod.id,
        amount: reloadAmountInFiat,
        confirm: true,
        metadata: { [AUTO_RECHARGE_METADATA_KEY]: "true" },
        idempotencyKey: `${WalletBalanceReloadCheck.name}.${resources.job.id}`,
        onAmountMismatch: "tolerate"
      });
      this.instrumentationService.recordReloadTriggered({
        mode,
        amount: reloadAmountInFiat,
        coverageRatio,
        projectedCost: costUntilTargetDateInFiat,
        logContext: log
      });
    } catch (error) {
      this.instrumentationService.recordReloadFailed({ mode, error, logContext: log });
      throw error;
    }
  }

  async #scheduleNextCheck(resources: Resources): Promise<void> {
    try {
      await this.walletReloadJobService.scheduleForWalletSetting(resources.walletSetting, {
        startAfter: this.#calculateNextCheckDate().toISOString(),
        withCleanup: true
      });
    } catch (error) {
      this.instrumentationService.recordSchedulingError(resources.wallet.address, error);
      throw error;
    }
  }

  #calculateNextCheckDate(): Date {
    return addMilliseconds(new Date(), this.#CHECK_INTERVAL_IN_MS);
  }
}
