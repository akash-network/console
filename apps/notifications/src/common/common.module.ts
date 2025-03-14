import { Module } from '@nestjs/common';

import { LoggerService } from './services/logger.service';
@Module({
  imports: [],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class CommonModule {}
