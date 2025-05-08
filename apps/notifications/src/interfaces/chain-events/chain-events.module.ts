import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { GlobalEnvConfig, globalEnvSchema } from '@src/config/env.config';
import { BrokerModule } from '@src/infrastructure/broker';
import { ChainModule } from '@src/modules/chain/chain.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      skipProcessEnv: true,
      validate: (config) => globalEnvSchema.parse(config),
    }),
    BrokerModule.registerAsync({
      useFactory: async (configService: ConfigService<GlobalEnvConfig>) => ({
        appName: configService.getOrThrow('APP_NAME'),
        postgresUri: configService.getOrThrow('EVENT_BROKER_POSTGRES_URI'),
      }),
      inject: [ConfigService],
    }),
    ChainModule,
  ],
})
export default class ChainEventsModule {}
