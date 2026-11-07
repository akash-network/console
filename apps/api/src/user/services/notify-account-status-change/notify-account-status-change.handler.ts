import { inject, singleton } from "tsyringe";

import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { type CreateNotificationInput, NotificationService } from "@src/notifications/services/notification/notification.service";
import { accountReinstatedNotification } from "@src/notifications/services/notification-templates/account-reinstated-notification";
import { accountSuspendedNotification } from "@src/notifications/services/notification-templates/account-suspended-notification";
import { accountTerminatedNotification } from "@src/notifications/services/notification-templates/account-terminated-notification";
import { type AccountStatusEventOutput, AccountStatusEventRepository } from "@src/user/repositories/account-status-event/account-status-event.repository";
import { type UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";
import { NotifyAccountStatusChange } from "./notify-account-status-change.job";

/** Sends through the transactional path, so a user who unsubscribed from product updates still hears about their own account. */
@singleton()
export class NotifyAccountStatusChangeHandler implements JobHandler<NotifyAccountStatusChange> {
  public readonly accepts = NotifyAccountStatusChange;

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly accountStatusEventRepository: AccountStatusEventRepository,
    private readonly userRepository: UserRepository,
    private readonly notificationService: NotificationService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: NotifyAccountStatusChangeHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ eventId }: JobPayload<NotifyAccountStatusChange>): Promise<void> {
    const event = await this.accountStatusEventRepository.findById(eventId);

    if (!event || event.notificationSentAt) {
      this.logger.info({ event: "ACCOUNT_STATUS_EMAIL_SKIPPED", reason: event ? "ALREADY_SENT" : "NO_EVENT", eventId });
      return;
    }

    const user = event.userId ? await this.userRepository.findById(event.userId) : undefined;

    if (!user?.email) {
      this.logger.info({ event: "ACCOUNT_STATUS_EMAIL_SKIPPED", reason: user ? "NO_EMAIL" : "USER_DELETED", eventId });
      return;
    }

    await this.notificationService.createNotification(notificationFor(event, user));
    await this.accountStatusEventRepository.markNotificationSent(eventId);

    this.logger.info({ event: "ACCOUNT_STATUS_EMAIL_SENT", eventId, userId: user.id, action: event.action });
  }
}

function notificationFor(event: AccountStatusEventOutput, user: UserOutput): CreateNotificationInput {
  const { id: eventId, userReason, options } = event;

  switch (event.action) {
    case "suspend":
      return accountSuspendedNotification(user, { eventId, userReason, closeDeployments: !!options.closeDeployments });
    case "reinstate":
      return accountReinstatedNotification(user, { eventId });
    case "terminate":
      return accountTerminatedNotification(user, { eventId, userReason, creditsForfeited: !!options.forfeitCredits });
  }
}
