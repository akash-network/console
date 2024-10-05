import { getSentry } from "@src/core/providers/sentry.provider";
import { LoggerService } from "@src/core/services/logger/logger.service";

export const createLoggingExecutor = (logger: LoggerService) => async <T>(cb: () => Promise<T>, defaultValue?: T): Promise<T> => {
  try {
    return await cb();
  } catch (error) {
    logger.error({ event: `Failed to fetch ${cb.name}`, error });
    getSentry().captureException(error);
    return defaultValue;
  }
}