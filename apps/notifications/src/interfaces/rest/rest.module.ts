import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CommonModule } from '@src/common/common.module';
import { globalEnvSchema } from '@src/config/env.config';
import { AlertModule } from '@src/modules/alert/alert.module';
import { AlertController } from './controllers/alert/alert.controller';

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
  controllers: [AlertController],
})
export default class RestModule {}
