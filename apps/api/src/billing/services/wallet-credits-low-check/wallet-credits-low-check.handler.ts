import { inject, singleton } from "tsyringe";

import { WalletCreditsLowCheck } from "@src/billing/events/wallet-credits-low-check";
import { isWalletInitialized, type UserWalletOutput, UserWalletRepository, WalletSettingRepository } from "@src/billing/repositories";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { type CreateLogger, type JobHandler, type JobPayload, LOGGER_FACTORY } from "@src/core";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { creditsRunningLowNotification } from "@src/notifications/services/notification-templates/credits-running-low-notification";
import { type UserOutput, UserRepository } from "@src/user/repositories";

type SkipReason = "auto_reload_enabled" | "no_wallet" | "trialing" | "no_email" | "zero_cost" | "sufficient_balance" | "already_notified" | "low_unconfirmed";

type NotLowReason = Extract<SkipReason, "zero_cost" | "sufficient_balance">;

const UNEXPECTED_SKIP_REASONS: ReadonlySet<SkipReason> = new Set(["no_wallet", "no_email"]);

@singleton()
export class WalletCreditsLowCheckHandler implements JobHandler<WalletCreditsLowCheck> {
  public readonly accepts = WalletCreditsLowCheck;

  public readonly concurrency = 2;

  public readonly policy = "singleton";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly userRepository: UserRepository,
    private readonly balancesService: BalancesService,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    private readonly notificationService: NotificationService,
    private readonly billingConfig: BillingConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: WalletCreditsLowCheckHandler.name });
  }

  async handle(payload: JobPayload<WalletCreditsLowCheck>): Promise<void> {
    const resources = await this.#getValidWalletResources(payload.userId);
    if (!resources) {
      return;
    }

    const { wallet, user } = resources;
    const balanceUsd = await this.balancesService.getDeploymentBalanceInFiat(wallet.address);
    const { weeklyCostUsd, cumulativeDailyCostsUsd, hasAutoTopUpSettings } = await this.drainingDeploymentService.calculateWeeklyCoverageForAddress(
      wallet.address
    );

    if (weeklyCostUsd === 0) {
      await this.#handleCreditsNotLow(wallet, payload.userId, "zero_cost", { canUnlatchImmediately: !hasAutoTopUpSettings });
      return;
    }

    if (balanceUsd >= weeklyCostUsd) {
      await this.#handleCreditsNotLow(wallet, payload.userId, "sufficient_balance", { canUnlatchImmediately: false });
      return;
    }

    if (wallet.creditsLowNotifiedAt) {
      await this.#endRecoveryStreak(wallet);
      this.#skip("already_notified", payload.userId);
      return;
    }

    if (!(await this.#isLowStreakConfirmed(wallet))) {
      this.#skip("low_unconfirmed", payload.userId);
      return;
    }

    const paymentLink = this.billingConfig.get("CONSOLE_WEB_PAYMENT_LINK");
    const daysRemaining = cumulativeDailyCostsUsd.filter(costUsd => costUsd <= balanceUsd).length;

    await this.notificationService.createNotification(
      creditsRunningLowNotification(user, {
        balanceUsd,
        weeklyCostUsd,
        daysRemaining,
        paymentLink,
        billingUrl: paymentLink.split("?")[0]
      })
    );

    await this.#stampNotified(wallet, payload.userId);

    this.logger.info({
      event: "CREDITS_LOW_EMAIL_SENT",
      userId: payload.userId,
      balanceUsd,
      weeklyCostUsd,
      daysRemaining
    });
  }

  /**
   * A failed stamp is logged instead of thrown: failing the job after a successful send would
   * make the queue retry the handler and resend the email it just delivered. At worst the
   * unstamped wallet sends one more email on the next scheduled check.
   */
  async #stampNotified(wallet: UserWalletOutput, userId: UserOutput["id"]): Promise<void> {
    try {
      await this.userWalletRepository.updateById(wallet.id, { creditsLowNotifiedAt: new Date(), creditsSufficientSince: null, creditsLowSince: null });
    } catch (error) {
      this.logger.error({ event: "CREDITS_LOW_NOTIFIED_STAMP_FAILED", userId, error });
    }
  }

  /** Mirrors the recovery latch on the sending side: a lone low reading only opens the window, so one misread cannot send an email by itself. */
  async #isLowStreakConfirmed(wallet: UserWalletOutput): Promise<boolean> {
    if (!wallet.creditsLowSince) {
      await this.userWalletRepository.updateById(wallet.id, { creditsLowSince: new Date() });
      return false;
    }

    return await this.userWalletRepository.isCreditsLowConfirmed(wallet.id, this.billingConfig.get("CREDITS_LOW_CONFIRM_WINDOW_MIN"));
  }

  async #getValidWalletResources(userId: UserOutput["id"]) {
    const walletSetting = await this.walletSettingRepository.findByUserId(userId);
    if (walletSetting?.autoReloadEnabled) {
      this.#skip("auto_reload_enabled", userId);
      return;
    }

    const wallet = await this.userWalletRepository.findOneByUserId(userId);
    if (!wallet || !isWalletInitialized(wallet)) {
      this.#skip("no_wallet", userId);
      return;
    }

    if (wallet.isTrialing) {
      this.#skip("trialing", userId);
      return;
    }

    const user = await this.userRepository.findById(userId);
    if (!user?.email) {
      this.#skip("no_email", userId);
      return;
    }

    return { wallet, user };
  }

  /** Nothing re-checks a wallet with no auto-top-up deployment left, so that verdict unlatches at once while a chain-derived one must hold for the window. */
  async #handleCreditsNotLow(
    wallet: UserWalletOutput,
    userId: UserOutput["id"],
    reason: NotLowReason,
    { canUnlatchImmediately }: { canUnlatchImmediately: boolean }
  ): Promise<void> {
    if (!wallet.creditsLowNotifiedAt) {
      await this.#endLowStreak(wallet);
      this.#skip(reason, userId);
      return;
    }

    if (canUnlatchImmediately) {
      await this.userWalletRepository.updateById(wallet.id, { creditsLowNotifiedAt: null, creditsSufficientSince: null, creditsLowSince: null });
      this.logger.info({ event: "CREDITS_LOW_NOTIFIED_CLEARED", userId, reason });
      this.#skip(reason, userId);
      return;
    }

    if (!wallet.creditsSufficientSince) {
      await this.userWalletRepository.updateById(wallet.id, { creditsSufficientSince: new Date() });
      this.#skip(reason, userId);
      return;
    }

    const isCleared = await this.userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed(
      wallet.id,
      this.billingConfig.get("CREDITS_LOW_RECOVERY_CONFIRM_WINDOW_MIN")
    );

    if (isCleared) {
      this.logger.info({ event: "CREDITS_LOW_NOTIFIED_CLEARED", userId, reason, creditsSufficientSince: wallet.creditsSufficientSince });
    }

    this.#skip(reason, userId);
  }

  async #endRecoveryStreak(wallet: UserWalletOutput): Promise<void> {
    if (!wallet.creditsSufficientSince) {
      return;
    }

    await this.userWalletRepository.updateById(wallet.id, { creditsSufficientSince: null });
  }

  async #endLowStreak(wallet: UserWalletOutput): Promise<void> {
    if (!wallet.creditsLowSince) {
      return;
    }

    await this.userWalletRepository.updateById(wallet.id, { creditsLowSince: null });
  }

  #skip(reason: SkipReason, userId: UserOutput["id"]): void {
    const payload = {
      event: "CREDITS_LOW_CHECK_SKIPPED",
      userId,
      reason
    };

    if (UNEXPECTED_SKIP_REASONS.has(reason)) {
      this.logger.warn(payload);
      return;
    }

    this.logger.info(payload);
  }
}
