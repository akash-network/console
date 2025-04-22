import { DrizzlePGModule, InjectDrizzle } from '@knaadh/nestjs-drizzle-pg';
import { Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Client } from 'pg';

import { DeploymentBalanceAlertRepository } from '@src/alert/repositories/deployment-balance-alert/deployment-balance-alert.repository';
import { RawAlertRepository } from '@src/alert/repositories/raw-alert/raw-alert.repository';
import { BlockchainNodeHttpService } from '@src/alert/services/blockchain-node-http/blockchain-node-http.service';
import { ConditionsMatcherService } from '@src/alert/services/conditions-matcher/conditions-matcher.service';
import { DeploymentService } from '@src/alert/services/deployment/deployment.service';
import { DeploymentBalanceAlertsService } from '@src/alert/services/deployment-balance-alerts/deployment-balance-alerts.service';
import { RawAlertsService } from '@src/alert/services/raw-alerts/raw-alerts.service';
import { TemplateService } from '@src/alert/services/template/template.service';
import { CommonModule } from '@src/common/common.module';
import { DRIZZLE_PROVIDER_TOKEN } from '@src/config/db.config';
import { GlobalEnvConfig } from '@src/config/env.config';
import { ChainEventsController } from './controllers/chain-events/chain-events.controller';
import * as schema from './model-schemas';

@Module({
  imports: [
    CommonModule,
    DrizzlePGModule.registerAsync({
      tag: DRIZZLE_PROVIDER_TOKEN,
      inject: [ConfigService],
      useFactory(configService: ConfigService<GlobalEnvConfig>) {
        return {
          pg: {
            connection: 'client',
            config: {
              connectionString: configService.getOrThrow(
                'NOTIFICATIONS_POSTGRES_URL',
              ),
            },
          },
          config: {
            schema,
            logger: true,
          },
        };
      },
    }),
  ],
  providers: [
    ChainEventsController,
    RawAlertsService,
    DeploymentBalanceAlertsService,
    RawAlertRepository,
    ConditionsMatcherService,
    DeploymentBalanceAlertRepository,
    DeploymentService,
    TemplateService,
    BlockchainNodeHttpService,
  ],
})
export class AlertModule implements OnApplicationShutdown {
  constructor(
    @InjectDrizzle(DRIZZLE_PROVIDER_TOKEN) private readonly db: NodePgDatabase,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await (
      this.db as unknown as {
        session: {
          client: Client;
        };
      }
    ).session.client.end();
  }
}
