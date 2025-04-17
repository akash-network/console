import type { LoggerService } from "@akashnetwork/logging";

export const createLoggingExecutor =
  (logger: LoggerService): LoggingExecutor =>
  async (cb, defaultValue?) => {
    try {
      return await cb();
    } catch (error) {
      logger.error({ event: `Failed to fetch ${cb.name}`, error });
      return defaultValue;
    }
  };

type LoggingExecutor = {
  <T>(cb: () => Promise<T>): Promise<T | undefined>;
  <T>(cb: () => Promise<T>, defaultValue: T): Promise<T>;
};
