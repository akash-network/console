import type { LoggerOptions, LoggerService } from "./services/logger/logger.service";

export type CreateLogger = (options?: LoggerOptions) => LoggerService;
