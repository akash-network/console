import { LoggerService as JsonLogger } from '@akashnetwork/logging';
import type { Provider } from '@nestjs/common';
import { Scope } from '@nestjs/common';

import { globalEnv } from '@src/config/env.config';
import { LoggerService as PrettyLogger } from '../services/logger/logger.service';

export const Logger =
  globalEnv.STD_OUT_LOG_FORMAT === 'pretty' ? PrettyLogger : JsonLogger;

export const LOGGER_PROVIDER: Provider = {
  provide: PrettyLogger,
  scope: Scope.TRANSIENT,
  useClass: Logger,
};
