import { LoggerService as JsonLogger } from "@akashnetwork/logging";
import type { Provider } from "@nestjs/common";
import { Scope } from "@nestjs/common";

import { commonEnvConfig } from "@src/common/config/env.config";
import { LoggerService as PrettyLogger } from "../services/logger/logger.service";

export const Logger = commonEnvConfig.STD_OUT_LOG_FORMAT === "pretty" ? PrettyLogger : JsonLogger;

export const LOGGER_PROVIDER: Provider = {
  provide: PrettyLogger,
  scope: Scope.TRANSIENT,
  useClass: Logger
};
