import { inject, singleton } from "tsyringe";

import { AutoRechargeSucceeded } from "@src/billing/events/auto-recharge-succeeded";
import { notifyEach } from "@src/billing/lib/notify-each/notify-each";
import { UserWalletRepository } from "@src/billing/repositories";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { BillingContactsService } from "@src/billing/services/billing-contacts/billing-contacts.service";
import { type CreateLogger, EventPayload, JobHandler, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { autoRechargeSucceededNotification } from "@src/notifications/services/notification-templates/auto-recharge-succeeded-notification";

@singleton()
export class AutoRechargeSucceededHandler implements JobHandler<AutoRechargeSucceeded> {
  public readonly accepts = AutoRechargeSucceeded;

  public readonly concurrency = 2;

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly billingContactsService: BillingContactsService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly balancesService: BalancesService,
    private readonly billingConfig: BillingConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: AutoRechargeSucceededHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle(payload: EventPayload<AutoRechargeSucceeded>): Promise<void> {
    const wallet = await this.#walletOf(payload);
    if (!wallet?.address) {
      this.logger.warn({
        event: "AUTO_RECHARGE_SUCCESS_EMAIL_SKIPPED",
        userId: payload.userId,
        reason: "Wallet address not found"
      });
      return;
    }

    const recipients = (await this.billingContactsService.findForWallet(wallet)).filter(user => !!user.email);
    if (!recipients.length) {
      this.logger.warn({
        event: "AUTO_RECHARGE_SUCCESS_EMAIL_SKIPPED",
        userId: payload.userId,
        reason: "User or email not found"
      });
      return;
    }

    const balanceUsd = await this.balancesService.getDeploymentBalanceInFiat(wallet.address);

    await notifyEach(
      recipients,
      user =>
        this.notificationService.createNotification(
          autoRechargeSucceededNotification(user, {
            transactionId: payload.transactionId,
            amountCents: payload.amountCents,
            balanceUsd,
            billingUrl: this.#billingUrl()
          })
        ),
      (user, error) => this.logger.error({ event: "AUTO_RECHARGE_SUCCESS_EMAIL_FAILED", userId: payload.userId, recipientUserId: user.id, error })
    );
  }

  async #walletOf({ walletId, userId }: EventPayload<AutoRechargeSucceeded>) {
    if (walletId) return await this.userWalletRepository.findById(walletId);

    return userId ? await this.userWalletRepository.findOneByUserId(userId) : undefined;
  }

  /**
   * CONSOLE_WEB_PAYMENT_LINK carries `?openPayment=true`, which auto-opens the manual Add-Funds modal.
   * This is an informational "you were already charged" email, so link to plain billing instead.
   */
  #billingUrl(): string {
    return this.billingConfig.get("CONSOLE_WEB_PAYMENT_LINK").split("?")[0];
  }
}
