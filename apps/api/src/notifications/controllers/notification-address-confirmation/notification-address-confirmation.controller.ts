import assert from "http-assert";
import { singleton } from "tsyringe";

import { NotificationService } from "@src/notifications/services/notification/notification.service";

@singleton()
export class NotificationAddressConfirmationController {
  constructor(private readonly notificationService: NotificationService) {}

  async create(token: string): Promise<void> {
    assert(await this.notificationService.confirmAddress(token), 400, "The confirmation link is invalid or was already used");
  }
}
