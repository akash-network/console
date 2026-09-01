import { inject, singleton } from "tsyringe";

import type { CardDecline } from "@src/billing/lib/card-decline/card-decline";
import { type ChargeClaim, WalletSettingRepository } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { autoTopUpPausedNotification } from "@src/notifications/services/notification-templates/auto-top-up-paused-notification";
import type { UserOutput } from "@src/user/repositories";

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

    return Math.min(base * 2 ** doublings, this.billingConfig.get("AUTO_RELOAD_CHARGE_BACKOFF_MAX_IN_MIN"));
  }

  async recordDecline(input: { claim: ChargeClaim; user: UserOutput; decline: CardDecline }): Promise<void> {
    const { claim, user, decline } = input;
    const { failureCount, pausedAt } = await this.walletSettingRepository.recordChargeDecline(claim, {
      maxConsecutiveDeclines: this.billingConfig.get("AUTO_RELOAD_MAX_CONSECUTIVE_DECLINES"),
      isTerminal: decline.isTerminal
    });

    if (!pausedAt) {
      this.logger.info({ event: "AUTO_RELOAD_CHARGE_DECLINED", userId: user.id, failureCount, declineCode: decline.declineCode });
      return;
    }

    this.logger.warn({ event: "AUTO_RELOAD_PAUSED", userId: user.id, failureCount, declineCode: decline.declineCode });

    await this.walletReloadJobService.cancelCreatedByUserId(user.id);
    await this.walletReloadJobService.scheduleCreditsLowCheck(user.id, { withCleanup: true });
    await this.notificationService.createNotification(autoTopUpPausedNotification(user, { pausedAt, billingUrl: this.#billingUrl() }));
  }

  async resume(userId: UserOutput["id"]): Promise<void> {
    const setting = await this.walletSettingRepository.findByUserId(userId);

    if (!setting?.autoReloadPausedAt) {
      return;
    }

    await this.walletSettingRepository.clearChargeState(setting.id);
    this.logger.info({ event: "AUTO_RELOAD_RESUMED", userId, pausedAt: setting.autoReloadPausedAt });

    if (setting.autoReloadEnabled) {
      await this.walletReloadJobService.scheduleForWalletSetting(setting, { withCleanup: true });
    }
  }

  /** CONSOLE_WEB_PAYMENT_LINK carries `?openPayment=true`, which opens the Add Funds modal rather than the payment methods the user needs to fix. */
  #billingUrl(): string {
    return this.billingConfig.get("CONSOLE_WEB_PAYMENT_LINK").split("?")[0];
  }
}
