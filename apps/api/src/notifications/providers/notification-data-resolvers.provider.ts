import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import type { Resolver } from "@src/core/providers/resolvers.provider";
import { DATA_RESOLVER } from "@src/core/providers/resolvers.provider";

export type NotificationDataResolvers = Record<string, Resolver>;
export const NOTIFICATION_DATA_RESOLVERS: InjectionToken<NotificationDataResolvers> = Symbol("NOTIFICATION_DATA_RESOLVERS");

container.register(NOTIFICATION_DATA_RESOLVERS, {
  useFactory: instancePerContainerCachingFactory(c => {
    const resolvers = c.resolveAll(DATA_RESOLVER);

    return resolvers.reduce((acc, resolver) => {
      acc[resolver.key] = resolver;
      return acc;
    }, {} as NotificationDataResolvers);
  })
});
