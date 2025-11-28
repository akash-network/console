import { createMongoAbility } from "@casl/ability";
import addDays from "date-fns/addDays";
import { isHttpError } from "http-errors";
import { Err, Ok, Result } from "ts-results";
import { singleton } from "tsyringe";

import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import type { GetBalancesResponseOutput } from "@src/billing/http-schemas/balance.schema";
import { UserWalletOutput, WalletSettingOutput, WalletSettingRepository } from "@src/billing/repositories";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { PaymentMethod, StripeService } from "@src/billing/services/stripe/stripe.service";
import { JobHandler, JobMeta, JobPayload, JobQueueService, LoggerService } from "@src/core";
import { isPayingUser, PayingUser } from "../paying-user/paying-user";

type ValidationError = {
  event: string;
  message: string;
  error?: unknown;
};

type Require<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: NonNullable<T[P]>;
};

type InitializedWallet = Require<Pick<UserWalletOutput, "address" | "isOldWallet">, "address">;
type ActionableWalletSetting = Require<
  Pick<WalletSettingOutput, "id" | "autoReloadThreshold" | "autoReloadAmount">,
  "autoReloadThreshold" | "autoReloadAmount"
>;

type Resources = {
  walletSetting: ActionableWalletSetting;
  wallet: InitializedWallet;
  user: PayingUser;
};
type AllResources = Resources & { balance: GetBalancesResponseOutput["data"]["total"]; paymentMethod: PaymentMethod };

@singleton()
export class WalletBalanceReloadCheckHandler implements JobHandler<WalletBalanceReloadCheck> {
  public readonly accepts = WalletBalanceReloadCheck;

  public readonly concurrency = 10;

  public readonly policy = "short";

  constructor(
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly balancesService: BalancesService,
    private readonly jobQueueService: JobQueueService,
    private readonly stripeService: StripeService,
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

    const { autoReloadAmount, autoReloadThreshold } = walletSetting;

    if (typeof autoReloadThreshold === "undefined") {
      return Err({
        event: "AUTO_RELOAD_THRESHOLD_NOT_SET",
        message: "Auto reload threshold not set. Skipping wallet balance reload check."
      });
    }

    if (typeof autoReloadAmount === "undefined") {
      return Err({
        event: "AUTO_RELOAD_AMOUNT_NOT_SET",
        message: "Auto reload amount not set. Skipping wallet balance reload check."
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
      walletSetting: { ...walletSetting, autoReloadAmount, autoReloadThreshold },
      wallet: { ...wallet, address },
      user
    });
  }

  async #getDefaultPaymentMethod(user: PayingUser): Promise<Result<PaymentMethod, ValidationError>> {
    try {
      return Ok(
        await this.stripeService.getDefaultPaymentMethod(
          user,
          createMongoAbility([
            {
              action: "read",
              subject: "PaymentMethod"
            }
          ])
        )
      );
    } catch (error) {
      if (isHttpError(error)) {
        return Err({
          event: "ERROR_RETRIEVING_DEFAULT_PAYMENT_METHOD",
          message: error.message,
          error
        });
      }

      throw error;
    }
  }

  #finishWithValidationError(error: ValidationError, userId: JobPayload<WalletBalanceReloadCheck>["userId"]): void {
    this.loggerService.info({
      ...error,
      userId: userId
    });
  }

  async #tryToReload(resources: AllResources & { job: JobMeta }): Promise<void> {
    const log = {
      walletAddress: resources.wallet.address,
      balance: resources.balance,
      threshold: resources.walletSetting.autoReloadThreshold,
      amount: resources.walletSetting.autoReloadAmount
    };

    try {
      if (resources.walletSetting.autoReloadThreshold >= resources.balance) {
        await this.stripeService.createPaymentIntent({
          customer: resources.user.stripeCustomerId,
          payment_method: resources.paymentMethod.id,
          amount: resources.walletSetting.autoReloadAmount,
          currency: "usd",
          confirm: true,
          idempotencyKey: `${WalletBalanceReloadCheck.name}.${resources.job.id}`
        });
        this.loggerService.info({
          ...log,
          event: "WALLET_BALANCE_RELOADED"
        });
      } else {
        this.loggerService.info({
          ...log,
          event: "WALLET_BALANCE_RELOAD_SKIPPED"
        });
      }
    } catch (error) {
      this.loggerService.error({
        event: "WALLET_BALANCE_RELOAD_FAILED",
        error: error
      });
      throw error;
    }
  }

  async #scheduleNextCheck(resources: Resources): Promise<void> {
    const jobId = await this.jobQueueService.enqueue(new WalletBalanceReloadCheck({ userId: resources.user.id }), {
      singletonKey: `${WalletBalanceReloadCheck.name}.${resources.user.id}`,
      startAfter: await this.#calculateNextCheckDate(resources.wallet)
    });

    if (jobId) {
      try {
        await this.walletSettingRepository.updateById(resources.walletSetting.id, { autoReloadJobId: jobId });
      } catch (error) {
        this.loggerService.error({
          event: "ERROR_UPDATING_AUTO_RELOAD_JOB_ID",
          error: error
        });
      }
    } else {
      this.loggerService.info({
        event: "FAILED_OBTAINING_NEXT_JOB_ID",
        walletAddress: resources.wallet.address
      });
    }
  }

  async #calculateNextCheckDate(wallet: InitializedWallet): Promise<Date> {
    this.loggerService.info({
      event: "CALCULATING_NEXT_CHECK_DATE",
      walletAddress: wallet.address,
      note: "Implementation pending..."
    });
    return addDays(new Date(), 1);
  }
}
