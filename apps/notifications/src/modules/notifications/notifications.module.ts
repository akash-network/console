import { DrizzlePGModule, InjectDrizzle } from '@knaadh/nestjs-drizzle-pg';
import { Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Client } from 'pg';

import { CommonModule } from '@src/common/common.module';
import { DRIZZLE_PROVIDER_TOKEN } from '@src/config/db.config';
import { GlobalEnvConfig } from '@src/config/env.config';
import moduleConfig from '@src/modules/notifications/config';
import { NovuProvider } from './providers/novu.provider';
import { ContactPointRepository } from './repositories/contact-point/contact-point.repository';
import { EmailSenderService } from './services/email-sender/email-sender.service';
import { NotificationRouterService } from './services/notification-router/notification-router.service';
import * as schema from './model-schemas';

@Module({
  imports: [
    CommonModule,
    ConfigModule.forFeature(moduleConfig),
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
    NovuProvider,
    EmailSenderService,
    NotificationRouterService,
    ContactPointRepository,
  ],
  exports: [NotificationRouterService],
})
export class NotificationsModule implements OnApplicationShutdown {
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
