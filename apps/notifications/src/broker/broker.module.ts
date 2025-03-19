import { DynamicModule, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from '@src/broker/broker-module.definition';
import { DbProvider } from '@src/broker/providers/db/db.provider';
import { CommonModule } from '@src/common/common.module';
import { PgBossProvider } from './providers/pg-boss/pg-boss.provider';
import { BrokerService } from './services/broker/broker.service';

@Global()
export class BrokerModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const { providers = [], exports = [], ...props } = super.register(options);
    return {
      ...props,
      imports: [CommonModule],
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
      imports: [CommonModule],
      providers: [...providers, BrokerService, PgBossProvider, DbProvider],
      exports: [...exports, BrokerService],
    };
  }
}
