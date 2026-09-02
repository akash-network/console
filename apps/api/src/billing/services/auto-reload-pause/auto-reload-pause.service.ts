import { inject, singleton } from "tsyringe";

import type { CardDecline } from "@src/billing/lib/card-decline/card-decline";
import { type ChargeClaim, UserWalletRepository, type WalletSettingOutput, WalletSettingRepository } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { type CreateNotificationInput, NotificationService } from "@src/notifications/services/notification/notification.service";
import { autoTopUpChargeFailedNotification } from "@src/notifications/services/notification-templates/auto-top-up-charge-failed-notification";
import { autoTopUpPausedNotification } from "@src/notifications/services/notification-templates/auto-top-up-paused-notification";
import type { UserOutput } from "@src/user/repositories";

/**
 * Only the first decline of a run is emailed, so a card that is merely having a bad day does not
 * send one message per attempt, and the user still hears within minutes rather than at the pause.
 */
const FIRST_DECLINE = 1;

/** Guards `2 ** exponent` against a raised decline limit, since the result is interpolated into a Postgres interval. */
const MAX_BACKOFF_DOUBLINGS = 16;

/**
 * Owns when Console stops charging a declining card and when it starts again. It lives apart from
 * `WalletSettingService` because the payment method paths that lift a pause cannot depend on that
 * service without a dependency cycle.
 */
@singleton()
export class AutoReloadPauseService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly walletReloadJobService: WalletReloadJobService,
    private readonly notificationService: NotificationService,
    private readonly billingConfig: BillingConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: AutoReloadPauseService.name });
  }

  /**
   * Doubles the gap after each consecutive decline, so the attempts a dead card is allowed span
   * hours instead of landing back to back. A base of 0 keeps meaning "no cap at all".
   */
  calculateChargeCooldownMinutes(failureCount: number): number {
    const base = this.billingConfig.get("AUTO_RELOAD_CHARGE_COOLDOWN_IN_MIN");

    if (base === 0 || failureCount <= 0) {
      return base;
    }

    const doublings = Math.min(failureCount - 1, MAX_BACKOFF_DOUBLINGS);
    const backedOff = Math.min(base * 2 ** doublings, this.billingConfig.get("AUTO_RELOAD_CHARGE_BACKOFF_MAX_IN_MIN"));

    return Math.max(base, backedOff);
  }

  async recordDecline(input: { claim: ChargeClaim; user: UserOutput; decline: CardDecline }): Promise<void> {
    const { claim, user, decline } = input;
    const { failureCount, pausedAt } = await this.walletSettingRepository.recordChargeDecline(claim, {
      maxConsecutiveDeclines: this.billingConfig.get("AUTO_RELOAD_MAX_CONSECUTIVE_DECLINES"),
      isTerminal: decline.isTerminal
    });

    if (!pausedAt) {
      this.logger.info({ event: "AUTO_RELOAD_CHARGE_DECLINED", userId: user.id, failureCount, declineCode: decline.declineCode });

      if (failureCount === FIRST_DECLINE) {
        await this.#notifyUser(autoTopUpChargeFailedNotification(user, { chargeAttemptedAt: claim.claimedAt, billingUrl: this.#billingUrl() }));
      }

      return;
    }

    this.logger.warn({ event: "AUTO_RELOAD_PAUSED", userId: user.id, failureCount, declineCode: decline.declineCode });

    await this.#notifyUser(autoTopUpPausedNotification(user, { pausedAt, billingUrl: this.#billingUrl() }));
    await this.#cancelPendingReloadCheck(user.id);
    await this.walletReloadJobService.scheduleCreditsLowCheck(user.id, { withCleanup: true });
  }

  /**
   * The decline is already committed, so a notifications outage must be logged as itself instead of
   * bubbling out to be recorded as a failure to record the decline.
   */
  async #notifyUser(notification: CreateNotificationInput): Promise<void> {
    try {
      await this.notificationService.createNotification(notification);
    } catch (error) {
      this.logger.error({ event: "AUTO_RELOAD_NOTIFICATION_FAILED", userId: notification.user.id, notificationId: notification.notificationId, error });
    }
  }

  /**
   * A check left queued skips on the pause it finds, so a failed cancel must not stop the
   * credits-low check that follows it from being scheduled.
   */
  async #cancelPendingReloadCheck(userId: UserOutput["id"]): Promise<void> {
    try {
      await this.walletReloadJobService.cancelCreatedByUserId(userId);
    } catch (error) {
      this.logger.error({ event: "AUTO_RELOAD_PAUSE_CANCEL_FAILED", userId, error });
    }
  }

  async resume(userId: UserOutput["id"]): Promise<void> {
    const setting = await this.walletSettingRepository.findByUserId(userId);

    if (!setting?.autoReloadPausedAt) {
      return;
    }

    await this.walletSettingRepository.clearChargeState(setting.id);
    this.logger.info({ event: "AUTO_RELOAD_RESUMED", userId, pausedAt: setting.autoReloadPausedAt });

    if (setting.autoReloadEnabled) {
      await this.#reactivate(setting);
    }
  }

  /**
   * Mirrors the fresh-enable transition: while paused the wallet was eligible for the credits-low
   * email, and leaving that latch stamped would suppress the email the next time it pauses.
   */
  async #reactivate(setting: WalletSettingOutput): Promise<void> {
    await this.walletReloadJobService.scheduleForWalletSetting(setting, { withCleanup: true });
    await this.walletReloadJobService.cancelCreditsLowCheckByUserId(setting.userId);
    await this.userWalletRepository.updateById(setting.walletId, { creditsLowNotifiedAt: null, creditsSufficientSince: null, creditsLowSince: null });
  }

  /** CONSOLE_WEB_PAYMENT_LINK carries `?openPayment=true`, which opens the Add Funds modal rather than the payment methods the user needs to fix. */
  #billingUrl(): string {
    return this.billingConfig.get("CONSOLE_WEB_PAYMENT_LINK").split("?")[0];
  }
}
