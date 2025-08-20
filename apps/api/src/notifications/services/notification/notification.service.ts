import { backOff, type BackoffOptions } from "exponential-backoff";
import { inject, singleton } from "tsyringe";

import { NOTIFICATIONS_API_CLIENT, NotificationsApiClient, operations } from "../../providers/notifications-api.provider";

const DEFAULT_BACKOFF_OPTIONS: BackoffOptions = {
  maxDelay: 5_000,
  startingDelay: 500,
  timeMultiple: 2,
  numOfAttempts: 10
};

@singleton()
export class NotificationService {
  constructor(@inject(NOTIFICATIONS_API_CLIENT) private readonly notificationsApi: NotificationsApiClient) {}

  async createNotification(input: CreateNotificationInput): Promise<void> {
    const { user, ...notification } = input;
    await backOff(async () => {
      const result = await this.notificationsApi.v1
        .createNotification({
          parameters: {
            header: {
              "x-user-id": user.id
            }
          } as any,
          body: notification
        })
        .catch(error => ({ error, response: null }));

      if (!result.error) return;

      if (result.error.code === "NOTIFICATION_CHANNEL_NOT_FOUND" && user.email) {
        await this.createDefaultChannel(user);
      }

      throw new Error("Failed to create notification", { cause: result.error });
    }, DEFAULT_BACKOFF_OPTIONS);
  }

  async createDefaultChannel(user: UserInput): Promise<void> {
    await backOff(async () => {
      const result = await this.notificationsApi.v1
        .createDefaultChannel({
          parameters: {
            header: {
              "x-user-id": user.id
            } as any
          },
          body: {
            data: {
              name: "Default",
              type: "email",
              config: {
                addresses: [user.email!]
              }
            }
          }
        })
        .catch(error => ({ error, response: null }));

      if (!result.error) return;

      throw new Error("Failed to create default notification channel", { cause: result.error });
    }, DEFAULT_BACKOFF_OPTIONS);
  }
}

interface UserInput {
  id: string;
  email?: string | null;
}

export type CreateNotificationInput = operations["createNotification"]["requestBody"]["content"]["application/json"] & {
  user: UserInput;
};
