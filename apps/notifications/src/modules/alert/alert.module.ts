import { DrizzlePGModule, InjectDrizzle } from '@knaadh/nestjs-drizzle-pg';
import { Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Client } from 'pg';

import { CommonModule } from '@src/common/common.module';
import { DRIZZLE_PROVIDER_TOKEN } from '@src/config/db.config';
import { GlobalEnvConfig } from '@src/config/env.config';
import { DeploymentBalanceAlertRepository } from '@src/modules/alert/repositories/deployment-balance-alert/deployment-balance-alert.repository';
import { RawAlertRepository } from '@src/modules/alert/repositories/raw-alert/raw-alert.repository';
import { AlertMessageService } from '@src/modules/alert/services/alert-message/alert-message.service';
import { BlockchainNodeHttpService } from '@src/modules/alert/services/blockchain-node-http/blockchain-node-http.service';
import { ConditionsMatcherService } from '@src/modules/alert/services/conditions-matcher/conditions-matcher.service';
import { DeploymentService } from '@src/modules/alert/services/deployment/deployment.service';
import { DeploymentBalanceAlertsService } from '@src/modules/alert/services/deployment-balance-alerts/deployment-balance-alerts.service';
import { RawAlertsService } from '@src/modules/alert/services/raw-alerts/raw-alerts.service';
import { TemplateService } from '@src/modules/alert/services/template/template.service';
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
    RawAlertsService,
    DeploymentBalanceAlertsService,
    RawAlertRepository,
    ConditionsMatcherService,
    DeploymentBalanceAlertRepository,
    AlertMessageService,
    DeploymentService,
    TemplateService,
    BlockchainNodeHttpService,
  ],
  exports: [
    RawAlertsService,
    DeploymentBalanceAlertsService,
    RawAlertRepository,
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
