import { InjectDrizzle } from "@knaadh/nestjs-drizzle-pg";
import { Injectable } from "@nestjs/common";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import type { FullSchema } from "@src/infrastructure/db/full-schema";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import { NotificationChannelRepository } from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";

export interface AccountPurgeResult {
  alertsDeleted: number;
  channelsDeleted: number;
}

@Injectable()
export class AccountPurgeService {
  constructor(
    @InjectDrizzle(DRIZZLE_PROVIDER_TOKEN)
    private readonly db: NodePgDatabase<FullSchema>,
    private readonly alertRepository: AlertRepository,
    private readonly notificationChannelRepository: NotificationChannelRepository
  ) {}

  /**
   * Wraps both deletes in a single transaction so partial state is impossible.
   * Alerts are deleted before channels — alerts FK channels with no cascade.
   */
  async purge(userId: string): Promise<AccountPurgeResult> {
    return this.db.transaction(async tx => {
      const alertsDeleted = await this.alertRepository.deleteAllByUserId(userId, tx);
      const channelsDeleted = await this.notificationChannelRepository.deleteAllByUserId(userId, tx);
      return { alertsDeleted, channelsDeleted };
    });
  }
}
