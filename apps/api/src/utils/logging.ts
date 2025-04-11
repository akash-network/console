import type { LoggerService } from "@akashnetwork/logging";

import { getSentry } from "@src/core/providers/sentry.provider";

export const createLoggingExecutor =
  (logger: LoggerService): LoggingExecutor =>
  async (cb, defaultValue?) => {
    try {
      return await cb();
    } catch (error) {
      logger.error({ event: `Failed to fetch ${cb.name}`, error });
      getSentry().captureException(error);
      return defaultValue;
    }
  };

type LoggingExecutor = {
  <T>(cb: () => Promise<T>): Promise<T | undefined>;
  <T>(cb: () => Promise<T>, defaultValue: T): Promise<T>;
};
