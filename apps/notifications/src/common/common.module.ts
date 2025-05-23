import { Module } from "@nestjs/common";

import { LOGGER_PROVIDER } from "@src/common/providers/logger.provider";
import { HealthzHelperService } from "@src/common/services/healthz-helper/healthz-helper.service";
import { ShutdownService } from "@src/common/services/shutdown/shutdown.service";
import { LoggerService } from "./services/logger/logger.service";

@Module({
  providers: [LoggerService, ShutdownService, HealthzHelperService, LOGGER_PROVIDER],
  exports: [LoggerService, ShutdownService, HealthzHelperService]
})
export class CommonModule {}
