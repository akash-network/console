import { inject, singleton } from "tsyringe";

import { WalletCreditsExhaustedCheck } from "@src/billing/events/wallet-credits-exhausted-check";
import { type UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import {
  type CreditsWarningIneligibility,
  CreditsWarningRecipientService
} from "@src/billing/services/credits-warning-recipient/credits-warning-recipient.service";
import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { creditsExhaustedNotification } from "@src/notifications/services/notification-templates/credits-exhausted-notification";
import type { UserOutput } from "@src/user/repositories";

type SkipReason = CreditsWarningIneligibility | "credits_low_not_notified" | "already_notified";

const UNEXPECTED_SKIP_REASONS: ReadonlySet<SkipReason> = new Set(["no_wallet", "no_email"]);

/** Warns a user a second time, once automatic funding gives up on a deployment, and only within a low episode the credits-low email opened. */
@singleton()
export class WalletCreditsExhaustedCheckHandler implements JobHandler<WalletCreditsExhaustedCheck> {
  public readonly accepts = WalletCreditsExhaustedCheck;

  public readonly concurrency = 2;

  public readonly policy = "singleton";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly creditsWarningRecipientService: CreditsWarningRecipientService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly notificationService: NotificationService,
    private readonly billingConfig: BillingConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: WalletCreditsExhaustedCheckHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle(payload: JobPayload<WalletCreditsExhaustedCheck>): Promise<void> {
    const recipient = await this.creditsWarningRecipientService.find(payload.userId);
    if (recipient.err) {
      this.#skip(recipient.val, payload.userId);
      return;
    }

    const { wallet, user } = recipient.val;

    if (!wallet.creditsLowNotifiedAt) {
      this.#skip("credits_low_not_notified", payload.userId);
      return;
    }

    if (wallet.creditsExhaustedNotifiedAt) {
      this.#skip("already_notified", payload.userId);
      return;
    }

    const paymentLink = this.billingConfig.get("CONSOLE_WEB_PAYMENT_LINK");

    await this.notificationService.createNotification(
      creditsExhaustedNotification(user, {
        firstClosingDseq: payload.firstClosingDseq,
        unfundedDeploymentCount: payload.unfundedDeploymentCount,
        firstClosureAt: payload.firstClosureAt,
        paymentLink,
        billingUrl: paymentLink.split("?")[0]
      })
    );

    await this.#stampNotified(wallet, payload.userId);

    this.logger.info({
      event: "CREDITS_EXHAUSTED_EMAIL_SENT",
      userId: payload.userId,
      firstClosingDseq: payload.firstClosingDseq,
      unfundedDeploymentCount: payload.unfundedDeploymentCount,
      firstClosureAt: payload.firstClosureAt
    });
  }

  /** A failed stamp is logged instead of thrown, since a retry would resend the email the user already has. */
  async #stampNotified(wallet: UserWalletOutput, userId: UserOutput["id"]): Promise<void> {
    try {
      await this.userWalletRepository.updateById(wallet.id, { creditsExhaustedNotifiedAt: new Date() });
    } catch (error) {
      this.logger.error({ event: "CREDITS_EXHAUSTED_NOTIFIED_STAMP_FAILED", userId, error });
    }
  }

  #skip(reason: SkipReason, userId: UserOutput["id"]): void {
    const payload = { event: "CREDITS_EXHAUSTED_CHECK_SKIPPED", userId, reason };

    if (UNEXPECTED_SKIP_REASONS.has(reason)) {
      this.logger.warn(payload);
      return;
    }

    this.logger.info(payload);
  }
}
