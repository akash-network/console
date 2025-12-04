import { createMongoAbility } from "@casl/ability";
import { addMilliseconds, millisecondsInHour } from "date-fns";
import { Err, Ok, Result } from "ts-results";
import { singleton } from "tsyringe";

import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import type { GetBalancesResponseOutput } from "@src/billing/http-schemas/balance.schema";
import { UserWalletOutput, WalletSettingOutput, WalletSettingRepository } from "@src/billing/repositories";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { PaymentMethod, StripeService } from "@src/billing/services/stripe/stripe.service";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { JobHandler, JobMeta, JobPayload, LoggerService } from "@src/core";
import type { Require } from "@src/core/types/require.type";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { isPayingUser, PayingUser } from "../paying-user/paying-user";

type ValidationError = {
  event: string;
  message: string;
};

type InitializedWallet = Require<Pick<UserWalletOutput, "address" | "isOldWallet">, "address">;
type ActionableWalletSetting = Pick<WalletSettingOutput, "id" | "userId" | "autoReloadJobId">;

type Resources = {
  walletSetting: ActionableWalletSetting;
  wallet: InitializedWallet;
  user: PayingUser;
};
type AllResources = Resources & { balance: GetBalancesResponseOutput["data"]["total"]; paymentMethod: PaymentMethod };

const millisecondsInDay = 24 * millisecondsInHour;

@singleton()
export class WalletBalanceReloadCheckHandler implements JobHandler<WalletBalanceReloadCheck> {
  public readonly accepts = WalletBalanceReloadCheck;

  public readonly concurrency = 10;

  public readonly policy = "short";

  #CHECK_INTERVAL_IN_MS = millisecondsInDay;

  #RELOAD_COVERAGE_PERIOD_IN_MS = 7 * millisecondsInDay;

  #MIN_COVERAGE_PERCENTAGE = 0.25;

  #MIN_RELOAD_AMOUNT_IN_USD = 20;

  constructor(
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly balancesService: BalancesService,
    private readonly walletReloadJobService: WalletReloadJobService,
    private readonly stripeService: StripeService,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(WalletBalanceReloadCheckHandler.name);
  }

  async handle(payload: JobPayload<WalletBalanceReloadCheck>, job: JobMeta): Promise<void> {
    const resourcesResult = await this.#collectResources(payload);

    if (resourcesResult.ok) {
      await this.#tryToReload({ ...resourcesResult.val, job });
      await this.#scheduleNextCheck(resourcesResult.val);
    } else {
      return this.#finishWithValidationError(resourcesResult.val, payload.userId);
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

    const balance = await this.balancesService.getFullBalanceInFiat(wallet.address, !!wallet.isOldWallet);

    return Ok({ ...walletResult.val, paymentMethod: paymentMethod.val, balance: balance.total });
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
    const paymentMethod = await this.stripeService.getDefaultPaymentMethod(
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

  #finishWithValidationError(error: ValidationError, userId: JobPayload<WalletBalanceReloadCheck>["userId"]): void {
    this.loggerService.error({
      ...error,
      userId: userId
    });
  }

  async #tryToReload(resources: AllResources & { job: JobMeta }): Promise<void> {
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

    if (costUntilTargetDateInFiat === 0 || resources.balance >= threshold) {
      this.loggerService.info({
        ...log,
        event: "WALLET_BALANCE_RELOAD_SKIPPED"
      });
      return;
    }

    try {
      const reloadAmountInFiat = Math.max(costUntilTargetDateInFiat - resources.balance, this.#MIN_RELOAD_AMOUNT_IN_USD);

      await this.stripeService.createPaymentIntent({
        customer: resources.user.stripeCustomerId,
        payment_method: resources.paymentMethod.id,
        amount: reloadAmountInFiat,
        currency: "usd",
        confirm: true,
        idempotencyKey: `${WalletBalanceReloadCheck.name}.${resources.job.id}`
      });
      this.loggerService.info({
        ...log,
        amount: reloadAmountInFiat,
        event: "WALLET_BALANCE_RELOADED"
      });
    } catch (error) {
      this.loggerService.error({
        ...log,
        event: "WALLET_BALANCE_RELOAD_FAILED",
        error: error
      });
      throw error;
    }
  }

  async #scheduleNextCheck(resources: Resources): Promise<void> {
    try {
      await this.walletReloadJobService.scheduleForWalletSetting(resources.walletSetting, {
        startAfter: this.#calculateNextCheckDate().toISOString(),
        prevAction: "complete"
      });
    } catch (error) {
      this.loggerService.error({
        event: "ERROR_SCHEDULING_NEXT_CHECK",
        walletAddress: resources.wallet.address,
        error: error
      });
      throw error;
    }
  }

  #calculateNextCheckDate(): Date {
    return addMilliseconds(new Date(), this.#CHECK_INTERVAL_IN_MS);
  }
}
