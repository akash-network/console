import { singleton } from "tsyringe";

import { FirstPurchaseBonusGranted } from "@src/billing/events/first-purchase-bonus-granted";
import { EventPayload, JobHandler, LoggerService } from "@src/core";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { firstPurchaseBonusGrantedNotification } from "@src/notifications/services/notification-templates/first-purchase-bonus-granted-notification";
import { UserRepository } from "@src/user/repositories";

@singleton()
export class FirstPurchaseBonusGrantedHandler implements JobHandler<FirstPurchaseBonusGranted> {
  public readonly accepts = FirstPurchaseBonusGranted;

  public readonly concurrency = 2;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly userRepository: UserRepository,
    private readonly logger: LoggerService
  ) {}

  async handle(payload: EventPayload<FirstPurchaseBonusGranted>): Promise<void> {
    const user = await this.userRepository.findById(payload.userId);
    if (!user?.email) {
      this.logger.warn({
        event: "FIRST_PURCHASE_BONUS_EMAIL_SKIPPED",
        userId: payload.userId,
        reason: "User or email not found"
      });
      return;
    }

    await this.notificationService.createNotification(
      firstPurchaseBonusGrantedNotification(user, {
        bonusAmountCents: payload.bonusAmountCents,
        paidAmountCents: payload.paidAmountCents
      })
    );
  }
}
