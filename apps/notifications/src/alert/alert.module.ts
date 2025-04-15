import { DrizzlePGModule } from '@knaadh/nestjs-drizzle-pg';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DeploymentBalanceAlertRepository } from '@src/alert/repositories/deployment-balance-alert/deployment-balance-alert.repository';
import { RawAlertRepository } from '@src/alert/repositories/raw-alert/raw-alert.repository';
import { ConditionsMatcherService } from '@src/alert/services/conditions-matcher/conditions-matcher.service';
import { DeploymentService } from '@src/alert/services/deployment/deployment.service';
import { DeploymentBalanceAlertsService } from '@src/alert/services/deployment-balance-alerts/deployment-balance-alerts.service';
import { RawAlertsService } from '@src/alert/services/raw-alerts/raw-alerts.service';
import { CommonModule } from '@src/common/common.module';
import { GlobalEnvConfig } from '@src/config/env.config';
import { ChainEventsController } from './controllers/chain-events/chain-events.controller';
import * as schema from './model-schemas';

@Module({
  imports: [
    CommonModule,
    DrizzlePGModule.registerAsync({
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
  ],
})
export class AlertModule {}
