import { DiscoveryModule } from '@golevelup/nestjs-discovery';
import {
  DynamicModule,
  Global,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import PgBoss from 'pg-boss';

import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from '@src/broker/broker-module.definition';
import { DbProvider } from '@src/broker/providers/db/db.provider';
import { PgBossHandlerService } from '@src/broker/services/pg-boss-handler/pg-boss-handler.service';
import { CommonModule } from '@src/common/common.module';
import { PgBossProvider } from './providers/pg-boss/pg-boss.provider';
import { BrokerService } from './services/broker/broker.service';

@Global()
export class BrokerModule
  extends ConfigurableModuleClass
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const { providers = [], exports = [], ...props } = super.register(options);
    return {
      ...props,
      imports: [CommonModule, DiscoveryModule],
      providers: [
        ...providers,
        BrokerService,
        PgBossProvider,
        DbProvider,
        {
          provide: ConfigService,
          useValue: new ConfigService(options),
        },
      ],
      exports: [...exports, BrokerService],
    };
  }

  static registerAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
    const {
      providers = [],
      exports = [],
      ...props
    } = super.registerAsync(options);
    return {
      ...props,
      imports: [CommonModule, DiscoveryModule],
      providers: [
        ...providers,
        BrokerService,
        PgBossProvider,
        DbProvider,
        PgBossHandlerService,
      ],
      exports: [...exports, BrokerService, PgBossHandlerService],
    };
  }

  constructor(
    private readonly pgBossHandlerService: PgBossHandlerService,
    private readonly pg: Client,
    private readonly boss: PgBoss,
  ) {
    super();
  }

  async onApplicationBootstrap() {
    await this.pgBossHandlerService.startAllHandlers();
  }

  async onApplicationShutdown() {
    await this.boss.stop();
    await this.pg.end();
  }
}
