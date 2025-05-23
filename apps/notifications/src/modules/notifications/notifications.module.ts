import { InjectDrizzle } from "@knaadh/nestjs-drizzle-pg";
import { Module, OnApplicationShutdown } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Client } from "pg";

import { CommonModule } from "@src/common/common.module";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { register } from "@src/infrastructure/db/db.module";
import { DbHealthzService } from "@src/infrastructure/db/services/db-healthz/db-healthz.service";
import moduleConfig from "@src/modules/notifications/config";
import { NovuProvider } from "./providers/novu.provider";
import { ContactPointRepository } from "./repositories/contact-point/contact-point.repository";
import { EmailSenderService } from "./services/email-sender/email-sender.service";
import { NotificationRouterService } from "./services/notification-router/notification-router.service";
import * as schema from "./model-schemas";

@Module({
  imports: [CommonModule, ConfigModule.forFeature(moduleConfig), ...register(schema)],
  providers: [NovuProvider, EmailSenderService, NotificationRouterService, ContactPointRepository, DbHealthzService],
  exports: [ContactPointRepository, NotificationRouterService, EmailSenderService, DbHealthzService]
})
export class NotificationsModule implements OnApplicationShutdown {
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
