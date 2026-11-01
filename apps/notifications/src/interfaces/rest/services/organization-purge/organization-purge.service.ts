import { InjectDrizzle } from "@knaadh/nestjs-drizzle-pg";
import { Injectable } from "@nestjs/common";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import type { FullSchema } from "@src/infrastructure/db/full-schema";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import { NotificationChannelRepository } from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";

export interface OrganizationPurgeResult {
  alertsDeleted: number;
  channelsDeleted: number;
}

@Injectable()
export class OrganizationPurgeService {
  constructor(
    @InjectDrizzle(DRIZZLE_PROVIDER_TOKEN)
    private readonly db: NodePgDatabase<FullSchema>,
    private readonly alertRepository: AlertRepository,
    private readonly notificationChannelRepository: NotificationChannelRepository
  ) {}

  /** Deletes the alerts before the channels they notify, since an alert's channel reference does not cascade. */
  async purge(organizationId: string): Promise<OrganizationPurgeResult> {
    return this.db.transaction(async tx => {
      const alertsDeleted = await this.alertRepository.deleteAllOfOrganization(organizationId, tx);
      const channelsDeleted = await this.notificationChannelRepository.deleteAllOfOrganization(organizationId, tx);
      return { alertsDeleted, channelsDeleted };
    });
  }
}
