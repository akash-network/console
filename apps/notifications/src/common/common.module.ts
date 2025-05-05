import { Module } from '@nestjs/common';

import { ShutdownService } from '@src/common/services/shutdown/shutdown.service';
import { LoggerService } from './services/logger/logger.service';

@Module({
  imports: [],
  providers: [LoggerService, ShutdownService],
  exports: [LoggerService, ShutdownService],
})
export class CommonModule {}
