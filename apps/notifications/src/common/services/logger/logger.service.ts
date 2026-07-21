import type { Logger as LoggerBase } from "@akashnetwork/logging";
import type { ConsoleLoggerOptions } from "@nestjs/common";
import { ConsoleLogger } from "@nestjs/common";

export class LoggerService extends ConsoleLogger implements LoggerBase {
  constructor(options: ConsoleLoggerOptions = {}) {
    const opts: ConsoleLoggerOptions = {
      prefix: "APP",
      ...options
    };
    super(opts);
  }

  info(message: unknown, ...optionalParams: [...any, string?]): void {
    return this.log(message, ...optionalParams);
  }
}
