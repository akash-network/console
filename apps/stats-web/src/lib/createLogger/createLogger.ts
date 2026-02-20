import type { LoggerOptions } from "@akashnetwork/logging";
import { LoggerService } from "@akashnetwork/logging";

export function createLogger(options?: LoggerOptions) {
  return new LoggerService({
    ...options
  });
}
