import { inject, singleton } from "tsyringe";

import { LoggerService } from "@src/core";
import type { NotificationDataResolvers } from "@src/notifications/providers/notification-data-resolvers.provider";
import { NOTIFICATION_DATA_RESOLVERS } from "@src/notifications/providers/notification-data-resolvers.provider";
import { UserOutput } from "@src/user/repositories";

declare const __resolved: unique symbol;
export type ResolvedValue<T> = T & { [__resolved]?: true };
export type IsResolved<T> = [T] extends [{ [__resolved]?: true }] ? true : false;

export type ResolvedMarker = "$resolved";
export const RESOLVED_MARKER: ResolvedMarker = "$resolved";

@singleton()
export class NotificationDataResolverService {
  constructor(
    @inject(NOTIFICATION_DATA_RESOLVERS) private readonly resolvers: NotificationDataResolvers,
    private readonly loggerService: LoggerService
  ) {
    loggerService.setContext(NotificationDataResolverService.name);
  }

  async resolve<T extends Record<string, unknown> | undefined>(user: UserOutput, vars: T): Promise<T> {
    if (!vars) {
      return vars;
    }

    const resolved: Record<string, unknown> = {};

    await Promise.all(
      Object.keys(vars).map(async key => {
        if (vars[key] !== RESOLVED_MARKER) {
          resolved[key] = vars[key];
          return;
        }

        if (!(key in this.resolvers)) {
          this.loggerService.error({ event: "UNKNOWN_NOTIFICATION_RESOLVER", key });
          return;
        }

        resolved[key] = await this.resolvers[key].resolve(user);
      })
    );

    return resolved as T;
  }
}
