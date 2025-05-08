import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CommonModule } from '@src/common/common.module';
import { globalEnvSchema } from '@src/config/env.config';
import { RawAlertController } from '@src/interfaces/rest/controllers/raw-alert/raw-alert.controller';
import { AlertModule } from '@src/modules/alert/alert.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      skipProcessEnv: true,
      validate: (config) => globalEnvSchema.parse(config),
    }),
    CommonModule,
    AlertModule,
  ],
  controllers: [RawAlertController],
})
export default class RestModule {}
