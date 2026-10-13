import { inject, singleton } from "tsyringe";

import { WalletCreditsLowCheck } from "@src/billing/events/wallet-credits-low-check";
import { notifyEach } from "@src/billing/lib/notify-each/notify-each";
import { pickWalletBillingTarget, type WalletBillingTarget } from "@src/billing/lib/wallet-billing-target/wallet-billing-target";
import { type UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import {
  type CreditsWarningIneligibility,
  CreditsWarningRecipientService
} from "@src/billing/services/credits-warning-recipient/credits-warning-recipient.service";
import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { creditsRunningLowNotification } from "@src/notifications/services/notification-templates/credits-running-low-notification";

type SkipReason = CreditsWarningIneligibility | "zero_cost" | "sufficient_balance" | "already_notified" | "low_unconfirmed";

type NotLowReason = Extract<SkipReason, "zero_cost" | "sufficient_balance">;

interface CreditsReadings {
  balanceUsd: number;
  weeklyCostUsd: number;
}

const UNEXPECTED_SKIP_REASONS: ReadonlySet<SkipReason> = new Set(["no_wallet", "no_email"]);

@singleton()
export class WalletCreditsLowCheckHandler implements JobHandler<WalletCreditsLowCheck> {
  public readonly accepts = WalletCreditsLowCheck;

  public readonly concurrency = 2;

  public readonly policy = "singleton";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly creditsWarningRecipientService: CreditsWarningRecipientService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly balancesService: BalancesService,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    private readonly notificationService: NotificationService,
    private readonly billingConfig: BillingConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: WalletCreditsLowCheckHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle(payload: JobPayload<WalletCreditsLowCheck>): Promise<void> {
    const target = pickWalletBillingTarget(payload);
    const recipient = await this.creditsWarningRecipientService.find(target);
    if (recipient.err) {
      this.#skip(recipient.val, target);
      return;
    }

    const { wallet, users } = recipient.val;
    const balanceUsd = await this.balancesService.getDeploymentBalanceInFiat(wallet.address);
    const { weeklyCostUsd, cumulativeDailyCostsUsd, hasAutoTopUpSettings } = await this.drainingDeploymentService.calculateWeeklyCoverageForAddress(
      wallet.address
    );

    if (weeklyCostUsd === 0) {
      await this.#handleCreditsNotLow(wallet, target, "zero_cost", { canUnlatchImmediately: !hasAutoTopUpSettings, balanceUsd, weeklyCostUsd });
      return;
    }

    if (balanceUsd >= weeklyCostUsd) {
      await this.#handleCreditsNotLow(wallet, target, "sufficient_balance", { canUnlatchImmediately: false, balanceUsd, weeklyCostUsd });
      return;
    }

    if (wallet.creditsLowNotifiedAt) {
      await this.#endRecoveryStreak(wallet);
      this.#skip("already_notified", target, { balanceUsd, weeklyCostUsd });
      return;
    }

    if (!(await this.#isLowStreakConfirmed(wallet))) {
      this.#skip("low_unconfirmed", target, { balanceUsd, weeklyCostUsd });
      return;
    }

    const paymentLink = this.billingConfig.get("CONSOLE_WEB_PAYMENT_LINK");
    const daysRemaining = cumulativeDailyCostsUsd.filter(costUsd => costUsd <= balanceUsd).length;

    await notifyEach(
      users,
      user =>
        this.notificationService.createNotification(
          creditsRunningLowNotification(user, {
            balanceUsd,
            weeklyCostUsd,
            daysRemaining,
            paymentLink,
            billingUrl: paymentLink.split("?")[0]
          })
        ),
      (user, error) => this.logger.error({ event: "CREDITS_LOW_EMAIL_FAILED", ...target, recipientUserId: user.id, error })
    );

    await this.#stampNotified(wallet, target);

    this.logger.info({
      event: "CREDITS_LOW_EMAIL_SENT",
      ...target,
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
  async #stampNotified(wallet: UserWalletOutput, target: WalletBillingTarget): Promise<void> {
    try {
      await this.userWalletRepository.updateById(wallet.id, {
        creditsLowNotifiedAt: new Date(),
        creditsSufficientSince: null,
        creditsLowSince: null,
        creditsExhaustedNotifiedAt: null
      });
    } catch (error) {
      this.logger.error({ event: "CREDITS_LOW_NOTIFIED_STAMP_FAILED", ...target, error });
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

  /** Nothing re-checks a wallet with no auto-top-up deployment left, so that verdict unlatches at once while a chain-derived one must hold for the window. */
  async #handleCreditsNotLow(
    wallet: UserWalletOutput,
    target: WalletBillingTarget,
    reason: NotLowReason,
    { canUnlatchImmediately, ...readings }: { canUnlatchImmediately: boolean } & CreditsReadings
  ): Promise<void> {
    if (!wallet.creditsLowNotifiedAt) {
      await this.#endLowStreak(wallet);
      this.#skip(reason, target, readings);
      return;
    }

    if (canUnlatchImmediately) {
      await this.userWalletRepository.updateById(wallet.id, { creditsLowNotifiedAt: null, creditsSufficientSince: null, creditsLowSince: null });
      this.logger.info({ event: "CREDITS_LOW_NOTIFIED_CLEARED", ...target, reason });
      this.#skip(reason, target, readings);
      return;
    }

    if (!wallet.creditsSufficientSince) {
      await this.userWalletRepository.updateById(wallet.id, { creditsSufficientSince: new Date() });
      this.#skip(reason, target, readings);
      return;
    }

    const isCleared = await this.userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed(wallet.id, {
      confirmWindowMinutes: this.billingConfig.get("CREDITS_LOW_RECOVERY_CONFIRM_WINDOW_MIN"),
      resendCooldownHours: this.billingConfig.get("CREDITS_LOW_RESEND_COOLDOWN_H")
    });

    if (isCleared) {
      this.logger.info({ event: "CREDITS_LOW_NOTIFIED_CLEARED", ...target, reason, creditsSufficientSince: wallet.creditsSufficientSince });
    }

    this.#skip(reason, target, readings);
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

  #skip(reason: SkipReason, target: WalletBillingTarget, readings?: CreditsReadings): void {
    const payload = {
      event: "CREDITS_LOW_CHECK_SKIPPED",
      ...target,
      reason,
      ...readings
    };

    if (UNEXPECTED_SKIP_REASONS.has(reason)) {
      this.logger.warn(payload);
      return;
    }

    this.logger.info(payload);
  }
}
