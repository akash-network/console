import { createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { requestFn } from "@openapi-qraft/react";
import type { InjectionToken } from "tsyringe";
import { container } from "tsyringe";

import type { NotificationsConfig } from "../config/env.config";
import { NOTIFICATIONS_CONFIG } from "./notifications-config.provider";

export type NotificationsApiClient = ReturnType<typeof createNotificationsApiClient>;
export const NOTIFICATIONS_API_CLIENT: InjectionToken<NotificationsApiClient> = Symbol("NOTIFICATIONS_API_CLIENT");

container.register(NOTIFICATIONS_API_CLIENT, {
  useFactory: c => createNotificationsApiClient(c.resolve(NOTIFICATIONS_CONFIG))
});

function createNotificationsApiClient(config: NotificationsConfig) {
  return createAPIClient({
    requestFn,
    baseUrl: config.NOTIFICATIONS_API_BASE_URL
  });
}

export { operations } from "@akashnetwork/react-query-sdk/notifications";
