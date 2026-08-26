import { inject, singleton } from "tsyringe";

import { FirstPurchaseBonusGranted } from "@src/billing/events/first-purchase-bonus-granted";
import { type CreateLogger, EventPayload, JobHandler, LOGGER_FACTORY } from "@src/core";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { firstPurchaseBonusGrantedNotification } from "@src/notifications/services/notification-templates/first-purchase-bonus-granted-notification";
import { UserRepository } from "@src/user/repositories";

@singleton()
export class FirstPurchaseBonusGrantedHandler implements JobHandler<FirstPurchaseBonusGranted> {
  public readonly accepts = FirstPurchaseBonusGranted;

  public readonly concurrency = 2;

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly userRepository: UserRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: FirstPurchaseBonusGrantedHandler.name });
  }

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
