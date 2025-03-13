import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DbProvider } from '@src/broker/providers/db/db.provider';
import { BrokerModuleConfig } from '@src/broker/types/module-config.type';
import { CommonModule } from '@src/common/common.module';
import { PgBossProvider } from './providers/pg-boss/pg-boss.provider';
import { BrokerService } from './services/broker/broker.service';

@Module({
  imports: [CommonModule],
  providers: [BrokerService, PgBossProvider, DbProvider],
  exports: [BrokerService],
})
export class BrokerModule {
  static forRoot(options: BrokerModuleConfig): DynamicModule {
    return {
      module: BrokerModule,
      imports: [CommonModule],
      providers: [
        BrokerService,
        PgBossProvider,
        DbProvider,
        {
          provide: ConfigService,
          useValue: new ConfigService(options),
        },
      ],
      exports: [BrokerService],
    };
  }
}
