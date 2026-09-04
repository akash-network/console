import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { LoggerService } from "@src/common/services/logger/logger.service";
import type { AlertConfig } from "@src/modules/alert/config";
import type { EventProviderMaintenanceOpenedDto } from "@src/modules/alert/dto/event-provider-maintenance-opened.dto";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import { ProviderActiveLeasesService } from "@src/modules/alert/services/provider-active-leases/provider-active-leases.service";
import type { MessageCallback } from "@src/modules/alert/types/message-callback.type";
import type { ProviderLeaseId } from "@src/modules/alert/types/provider-lease.type";

@Injectable()
export class ProviderMaintenanceAlertService {
  constructor(
    private readonly activeLeases: ProviderActiveLeasesService,
    private readonly alertRepository: AlertRepository,
    private readonly configService: ConfigService<AlertConfig>,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(ProviderMaintenanceAlertService.name);
  }

  async alertFor(event: EventProviderMaintenanceOpenedDto, onMessage: MessageCallback): Promise<void> {
    if (!this.configService.getOrThrow("alert.PROVIDER_MAINTENANCE_ALERTS_ENABLED")) return;

    const leases = await this.activeLeases.list(event.provider);
    await Promise.all(leases.map(lease => this.alertForLease(event, lease, onMessage)));
  }

  private async alertForLease(event: EventProviderMaintenanceOpenedDto, lease: ProviderLeaseId, onMessage: MessageCallback): Promise<void> {
    const alert = await this.alertRepository.findDeploymentClosedAlertByOwnerAndDseq(lease.owner, lease.dseq);
    if (!alert?.enabled) return;

    const claim = await this.alertRepository.claimProviderMaintenanceNotification(alert.id, event.provider, event.maintenance_id, lease);
    if (!claim) return;

    try {
      await onMessage({
        notificationChannelId: claim.alert.notificationChannelId,
        payload: {
          summary: `Provider maintenance scheduled for deployment ${lease.dseq}`,
          description: this.description(event, lease)
        }
      });
      await this.alertRepository.completeProviderMaintenanceNotification(alert.id, event.provider, event.maintenance_id, lease, claim.claimId);
    } catch (error) {
      await this.alertRepository.releaseProviderMaintenanceNotification(alert.id, event.provider, event.maintenance_id, lease, claim.claimId);
      throw error;
    }
  }

  private description(event: EventProviderMaintenanceOpenedDto, lease: ProviderLeaseId): string {
    const type = event.maintenance_type.replace(/^provider_maintenance_type_/, "").replaceAll("_", " ");
    const baseUrl = this.configService.getOrThrow("alert.CONSOLE_WEB_URL");
    const link = `<a href="https://${baseUrl}/deployments/${lease.dseq}">${baseUrl}</a>`;

    return (
      `Provider ${event.provider} announced ${type} maintenance for lease group ${lease.gseq}/${lease.oseq}. ` +
      `The window starts at ${event.starts_at} and is expected to end at ${event.expected_ends_at}. ` +
      `The lease remains open. Please visit ${link} to review the deployment.`
    );
  }
}
