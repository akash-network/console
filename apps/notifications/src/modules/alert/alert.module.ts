import { InjectDrizzle } from "@knaadh/nestjs-drizzle-pg";
import { Module, OnApplicationShutdown } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Client } from "pg";

import { CommonModule } from "@src/common/common.module";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { register } from "@src/infrastructure/db/db.module";
import { HTTP_SDK_PROVIDERS } from "./providers/http-sdk.provider";
import { DeploymentBalanceAlertRepository } from "./repositories/deployment-balance-alert/deployment-balance-alert.repository";
import { RawAlertRepository } from "./repositories/raw-alert/raw-alert.repository";
import { AlertMessageService } from "./services/alert-message/alert-message.service";
import { ConditionsMatcherService } from "./services/conditions-matcher/conditions-matcher.service";
import { DeploymentService } from "./services/deployment/deployment.service";
import { DeploymentBalanceAlertsService } from "./services/deployment-balance-alerts/deployment-balance-alerts.service";
import { RawAlertsService } from "./services/raw-alerts/raw-alerts.service";
import { TemplateService } from "./services/template/template.service";
import moduleConfig from "./config";
import * as schema from "./model-schemas";

@Module({
  imports: [CommonModule, ...register(schema), ConfigModule.forFeature(moduleConfig)],
  providers: [
    RawAlertsService,
    DeploymentBalanceAlertsService,
    RawAlertRepository,
    ConditionsMatcherService,
    DeploymentBalanceAlertRepository,
    AlertMessageService,
    DeploymentService,
    TemplateService,
    ...HTTP_SDK_PROVIDERS
  ],
  exports: [RawAlertsService, DeploymentBalanceAlertsService, RawAlertRepository]
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
