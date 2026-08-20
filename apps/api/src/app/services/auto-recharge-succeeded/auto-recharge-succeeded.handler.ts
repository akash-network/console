import { singleton } from "tsyringe";

import { AutoRechargeSucceeded } from "@src/billing/events/auto-recharge-succeeded";
import { UserWalletRepository } from "@src/billing/repositories";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { EventPayload, JobHandler, LoggerService } from "@src/core";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { autoRechargeSucceededNotification } from "@src/notifications/services/notification-templates/auto-recharge-succeeded-notification";
import { UserRepository } from "@src/user/repositories";

@singleton()
export class AutoRechargeSucceededHandler implements JobHandler<AutoRechargeSucceeded> {
  public readonly accepts = AutoRechargeSucceeded;

  public readonly concurrency = 2;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly userRepository: UserRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly balancesService: BalancesService,
    private readonly billingConfig: BillingConfigService,
    private readonly logger: LoggerService
  ) {}

  async handle(payload: EventPayload<AutoRechargeSucceeded>): Promise<void> {
    const user = await this.userRepository.findById(payload.userId);
    if (!user?.email) {
      this.logger.warn({
        event: "AUTO_RECHARGE_SUCCESS_EMAIL_SKIPPED",
        userId: payload.userId,
        reason: "User or email not found"
      });
      return;
    }

    const wallet = await this.userWalletRepository.findOneByUserId(user.id);
    if (!wallet?.address) {
      this.logger.warn({
        event: "AUTO_RECHARGE_SUCCESS_EMAIL_SKIPPED",
        userId: payload.userId,
        reason: "Wallet address not found"
      });
      return;
    }

    const balanceUsd = await this.balancesService.getDeploymentBalanceInFiat(wallet.address);

    await this.notificationService.createNotification(
      autoRechargeSucceededNotification(user, {
        transactionId: payload.transactionId,
        amountCents: payload.amountCents,
        balanceUsd,
        billingUrl: this.#billingUrl()
      })
    );
  }

  /**
   * CONSOLE_WEB_PAYMENT_LINK carries `?openPayment=true`, which auto-opens the manual Add-Funds modal.
   * This is an informational "you were already charged" email, so link to plain billing instead.
   */
  #billingUrl(): string {
    return this.billingConfig.get("CONSOLE_WEB_PAYMENT_LINK").split("?")[0];
  }
}
