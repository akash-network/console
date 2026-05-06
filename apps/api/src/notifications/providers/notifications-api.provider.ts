import type { operationDefs as PublicOperationDefs, paths as PublicPaths } from "@akashnetwork/console-api-types/notifications";
import { operations as publicOperations } from "@akashnetwork/console-api-types/notifications";
import type { operationDefs as InternalOperationDefs, paths as InternalPaths } from "@akashnetwork/console-api-types/notifications/internal";
import { operations as internalOperations } from "@akashnetwork/console-api-types/notifications/internal";
import { createApi, type TypedClient } from "@akashnetwork/openapi-sdk";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import type { NotificationsConfig } from "../config/env.config";
import { NOTIFICATIONS_CONFIG } from "./notifications-config.provider";

export type NotificationsApiClient = TypedClient<PublicPaths, typeof publicOperations>;
export type NotificationsInternalApiClient = TypedClient<InternalPaths, typeof internalOperations>;

export const NOTIFICATIONS_API_CLIENT: InjectionToken<NotificationsApiClient> = Symbol("NOTIFICATIONS_API_CLIENT");
export const NOTIFICATIONS_INTERNAL_API_CLIENT: InjectionToken<NotificationsInternalApiClient> = Symbol("NOTIFICATIONS_INTERNAL_API_CLIENT");

container.register(NOTIFICATIONS_API_CLIENT, {
  useFactory: instancePerContainerCachingFactory(c =>
    createApi<PublicPaths, typeof publicOperations>(publicOperations, { baseUrl: c.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL })
  )
});

container.register(NOTIFICATIONS_INTERNAL_API_CLIENT, {
  useFactory: instancePerContainerCachingFactory(c =>
    createApi<InternalPaths, typeof internalOperations>(internalOperations, { baseUrl: c.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL })
  )
});

export type { PublicOperationDefs as NotificationsOperationDefs, InternalOperationDefs as NotificationsInternalOperationDefs };

export type { NotificationsConfig };
