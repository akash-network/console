import { InjectDrizzle } from "@knaadh/nestjs-drizzle-pg";
import { Module, OnApplicationShutdown } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Client } from "pg";

import { CommonModule } from "@src/common/common.module";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { register } from "@src/infrastructure/db/db.module";
import { DbHealthzService } from "@src/infrastructure/db/services/db-healthz/db-healthz.service";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import { ChainAlertService } from "@src/modules/alert/services/chain-alert/chain-alert.service";
import { DeploymentAlertService } from "@src/modules/alert/services/deployment-alert/deployment-alert.service";
import { HTTP_SDK_PROVIDERS } from "./providers/http-sdk.provider";
import { AlertMessageService } from "./services/alert-message/alert-message.service";
import { ConditionsMatcherService } from "./services/conditions-matcher/conditions-matcher.service";
import { DeploymentService } from "./services/deployment/deployment.service";
import { DeploymentBalanceAlertsService } from "./services/deployment-balance-alerts/deployment-balance-alerts.service";
import { TemplateService } from "./services/template/template.service";
import moduleConfig from "./config";
import * as schema from "./model-schemas";

@Module({
  imports: [CommonModule, ...register(schema), ConfigModule.forFeature(moduleConfig)],
  providers: [
    AlertRepository,
    ChainAlertService,
    DeploymentBalanceAlertsService,
    ConditionsMatcherService,
    AlertMessageService,
    DeploymentService,
    TemplateService,
    DeploymentAlertService,
    DbHealthzService,
    ...HTTP_SDK_PROVIDERS
  ],
  exports: [ChainAlertService, DeploymentBalanceAlertsService, AlertRepository, DeploymentAlertService, DbHealthzService]
})
export class AlertModule implements OnApplicationShutdown {
  constructor(@InjectDrizzle(DRIZZLE_PROVIDER_TOKEN) private readonly db: NodePgDatabase) {}

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
