import { inject, singleton } from "tsyringe";

import { calculateChargeCooldownMinutes } from "@src/billing/lib/auto-reload/charge-cooldown";
import type { BillingOwner } from "@src/billing/lib/billing-owner/billing-owner";
import { AUTHENTICATION_REQUIRED_DECLINE_CODE, type CardDecline } from "@src/billing/lib/card-decline/card-decline";
import type { WalletBillingTarget } from "@src/billing/lib/wallet-billing-target/wallet-billing-target";
import { type ChargeClaim, UserWalletRepository, type WalletSettingOutput, WalletSettingRepository } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { BillingContactsService } from "@src/billing/services/billing-contacts/billing-contacts.service";
import type { ChargedPayer } from "@src/billing/services/payer/payer";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { type CreateNotificationInput, NotificationService } from "@src/notifications/services/notification/notification.service";
import { autoTopUpAuthenticationRequiredNotification } from "@src/notifications/services/notification-templates/auto-top-up-authentication-required-notification";
import { autoTopUpChargeFailedNotification } from "@src/notifications/services/notification-templates/auto-top-up-charge-failed-notification";
import { autoTopUpPausedNotification } from "@src/notifications/services/notification-templates/auto-top-up-paused-notification";
import type { UserOutput } from "@src/user/repositories";

/**
 * Only the first decline of a run is emailed, so a card that is merely having a bad day does not
 * send one message per attempt, and the user still hears within minutes rather than at the pause.
 */
const FIRST_DECLINE = 1;

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
    private readonly billingContactsService: BillingContactsService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: AutoReloadPauseService.name });
  }

  calculateChargeCooldownMinutes(failureCount: number): number {
    return calculateChargeCooldownMinutes(
      {
        baseMinutes: this.billingConfig.get("AUTO_RELOAD_CHARGE_COOLDOWN_IN_MIN"),
        maxMinutes: this.billingConfig.get("AUTO_RELOAD_CHARGE_BACKOFF_MAX_IN_MIN")
      },
      failureCount
    );
  }

  async recordDecline(input: { claim: ChargeClaim; payer: ChargedPayer; target: WalletBillingTarget; decline: CardDecline }): Promise<void> {
    const { claim, payer, target, decline } = input;
    const userId = payer.user?.id;
    const { failureCount, pausedAt } = await this.walletSettingRepository.recordChargeDecline(claim, {
      maxConsecutiveDeclines: this.billingConfig.get("AUTO_RELOAD_MAX_CONSECUTIVE_DECLINES"),
      isTerminal: decline.isTerminal
    });

    if (!pausedAt) {
      this.logger.info({ event: "AUTO_RELOAD_CHARGE_DECLINED", userId, failureCount, declineCode: decline.declineCode });

      if (failureCount === FIRST_DECLINE) {
        await this.#notifyBillingContacts(payer, contact =>
          autoTopUpChargeFailedNotification(contact, { chargeAttemptedAt: claim.claimedAt, billingUrl: this.#billingUrl() })
        );
      }

      return;
    }

    this.logger.warn({ event: "AUTO_RELOAD_PAUSED", userId, failureCount, declineCode: decline.declineCode });

    await this.#notifyBillingContacts(payer, contact => this.#pausedNotification(contact, pausedAt, decline));
    await this.#cancelPendingReloadCheck(target);
    await this.walletReloadJobService.scheduleCreditsLowCheck(target, { withCleanup: true });
  }

  #pausedNotification(user: UserOutput, pausedAt: Date, decline: CardDecline): CreateNotificationInput {
    if (decline.declineCode === AUTHENTICATION_REQUIRED_DECLINE_CODE) {
      return autoTopUpAuthenticationRequiredNotification(user, { pausedAt, paymentUrl: this.billingConfig.get("CONSOLE_WEB_PAYMENT_LINK") });
    }

    return autoTopUpPausedNotification(user, { pausedAt, billingUrl: this.#billingUrl() });
  }

  async #notifyBillingContacts(payer: ChargedPayer, notificationFor: (contact: UserOutput) => CreateNotificationInput): Promise<void> {
    for (const contact of await this.billingContactsService.findForPayer(payer)) {
      await this.#notifyUser(notificationFor(contact));
    }
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
  async #cancelPendingReloadCheck(target: WalletBillingTarget): Promise<void> {
    try {
      await this.walletReloadJobService.cancelReloadCheck(target);
    } catch (error) {
      this.logger.error({ event: "AUTO_RELOAD_PAUSE_CANCEL_FAILED", ...target, error });
    }
  }

  async resume(owner: BillingOwner): Promise<void> {
    const setting = await this.#findSettingOf(owner);

    if (!setting?.autoReloadPausedAt) {
      return;
    }

    await this.walletSettingRepository.clearChargeState(setting.id);
    this.logger.info({ event: "AUTO_RELOAD_RESUMED", ...owner, pausedAt: setting.autoReloadPausedAt });

    if (setting.autoReloadEnabled) {
      await this.#reactivate(setting);
    }
  }

  /**
   * Mirrors the fresh-enable transition: while paused the wallet was eligible for the credits-low
   * email, and leaving that latch stamped would suppress the email the next time it pauses.
   */
  async #findSettingOf(owner: BillingOwner): Promise<WalletSettingOutput | undefined> {
    if ("userId" in owner) {
      return await this.walletSettingRepository.findByUserId(owner.userId);
    }

    const wallet = await this.userWalletRepository.findOneByOrganizationId(owner.organizationId);

    return wallet && (await this.walletSettingRepository.findOneBy({ walletId: wallet.id }));
  }

  async #reactivate(setting: WalletSettingOutput): Promise<void> {
    await this.walletReloadJobService.scheduleForWalletSetting(setting, { withCleanup: true });
    await this.walletReloadJobService.cancelCreditsLowCheck(await this.walletReloadJobService.targetOf(setting));
    await this.userWalletRepository.updateById(setting.walletId, { creditsLowNotifiedAt: null, creditsSufficientSince: null, creditsLowSince: null });
  }

  /** CONSOLE_WEB_PAYMENT_LINK carries `?openPayment=true`, which opens the Add Funds modal rather than the payment methods the user needs to fix. */
  #billingUrl(): string {
    return this.billingConfig.get("CONSOLE_WEB_PAYMENT_LINK").split("?")[0];
  }
}
