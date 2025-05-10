import { Module } from '@nestjs/common';

import { LOGGER_PROVIDER } from '@src/common/providers/logger.provider';
import { ShutdownService } from '@src/common/services/shutdown/shutdown.service';
import { LoggerService } from './services/logger/logger.service';

@Module({
  imports: [],
  providers: [LoggerService, ShutdownService, LOGGER_PROVIDER],
  exports: [LoggerService, ShutdownService],
})
export class CommonModule {}
