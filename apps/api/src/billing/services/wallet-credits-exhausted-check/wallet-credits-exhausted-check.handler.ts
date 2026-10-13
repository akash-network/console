import { inject, singleton } from "tsyringe";

import { WalletCreditsExhaustedCheck } from "@src/billing/events/wallet-credits-exhausted-check";
import { notifyEach } from "@src/billing/lib/notify-each/notify-each";
import { pickWalletBillingTarget, type WalletBillingTarget } from "@src/billing/lib/wallet-billing-target/wallet-billing-target";
import { type UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import {
  type CreditsWarningIneligibility,
  CreditsWarningRecipientService
} from "@src/billing/services/credits-warning-recipient/credits-warning-recipient.service";
import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { creditsExhaustedNotification } from "@src/notifications/services/notification-templates/credits-exhausted-notification";

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
    const target = pickWalletBillingTarget(payload);
    const recipient = await this.creditsWarningRecipientService.find(target);
    if (recipient.err) {
      this.#skip(recipient.val, target);
      return;
    }

    const { wallet, users } = recipient.val;

    if (!wallet.creditsLowNotifiedAt) {
      this.#skip("credits_low_not_notified", target);
      return;
    }

    if (wallet.creditsExhaustedNotifiedAt) {
      this.#skip("already_notified", target);
      return;
    }

    const paymentLink = this.billingConfig.get("CONSOLE_WEB_PAYMENT_LINK");

    await notifyEach(
      users,
      user =>
        this.notificationService.createNotification(
          creditsExhaustedNotification(user, {
            firstClosingDseq: payload.firstClosingDseq,
            unfundedDeploymentCount: payload.unfundedDeploymentCount,
            firstClosureAt: payload.firstClosureAt,
            paymentLink,
            billingUrl: paymentLink.split("?")[0]
          })
        ),
      (user, error) => this.logger.error({ event: "CREDITS_EXHAUSTED_EMAIL_FAILED", ...target, recipientUserId: user.id, error })
    );

    await this.#stampNotified(wallet, target);

    this.logger.info({
      event: "CREDITS_EXHAUSTED_EMAIL_SENT",
      ...target,
      firstClosingDseq: payload.firstClosingDseq,
      unfundedDeploymentCount: payload.unfundedDeploymentCount,
      firstClosureAt: payload.firstClosureAt
    });
  }

  /** A failed stamp is logged instead of thrown, since a retry would resend the email the user already has. */
  async #stampNotified(wallet: UserWalletOutput, target: WalletBillingTarget): Promise<void> {
    try {
      await this.userWalletRepository.updateById(wallet.id, { creditsExhaustedNotifiedAt: new Date() });
    } catch (error) {
      this.logger.error({ event: "CREDITS_EXHAUSTED_NOTIFIED_STAMP_FAILED", ...target, error });
    }
  }

  #skip(reason: SkipReason, target: WalletBillingTarget): void {
    const payload = { event: "CREDITS_EXHAUSTED_CHECK_SKIPPED", ...target, reason };

    if (UNEXPECTED_SKIP_REASONS.has(reason)) {
      this.logger.warn(payload);
      return;
    }

    this.logger.info(payload);
  }
}
