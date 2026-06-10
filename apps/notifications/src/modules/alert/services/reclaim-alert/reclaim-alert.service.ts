import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { LoggerService } from "@src/common/services/logger/logger.service";
import type { AlertConfig } from "@src/modules/alert/config";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import type { AlertMessagePayload } from "@src/modules/alert/services/alert-message/alert-message.service";
import { getLeaseClosedReasonText, toLeaseClosedReason } from "@src/modules/alert/services/reclaim-alert/lease-closed-reason";
import { formatReclaimDeadline } from "@src/modules/alert/services/reclaim-alert/reclaim-deadline";
import type { MessageCallback } from "@src/modules/alert/types/message-callback.type";

export interface ReclaimAlertEvent {
  owner: string;
  dseq: string;
  provider: string;
  reason: string | number;
  deadline: string | number;
}

@Injectable()
export class ReclaimAlertService {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly configService: ConfigService<AlertConfig>,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(ReclaimAlertService.name);
  }

  async alertFor(event: ReclaimAlertEvent, onMessage: MessageCallback): Promise<void> {
    const alert = await this.alertRepository.findDeploymentClosedAlertByOwnerAndDseq(event.owner, event.dseq);

    if (!alert) {
      this.loggerService.debug({ event: "RECLAIM_ALERT_SKIPPED", reason: "NO_DEPLOYMENT_CLOSED_ALERT", owner: event.owner, dseq: event.dseq });
      return;
    }

    if (!alert.enabled) {
      this.loggerService.debug({ event: "RECLAIM_ALERT_SKIPPED", reason: "OPTED_OUT", alertId: alert.id });
      return;
    }

    const claimedAlert = await this.alertRepository.claimReclaimNotification(alert.id);

    if (!claimedAlert) {
      this.loggerService.debug({ event: "RECLAIM_ALERT_SKIPPED", reason: "ALREADY_NOTIFIED", alertId: alert.id });
      return;
    }

    await onMessage({
      notificationChannelId: claimedAlert.notificationChannelId,
      payload: this.buildMessage(event)
    });
  }

  private buildMessage(event: ReclaimAlertEvent): AlertMessagePayload {
    const reasonText = getLeaseClosedReasonText(toLeaseClosedReason(event.reason));
    const deadline = formatReclaimDeadline(Number(event.deadline), Date.now());
    const link = this.getConsoleLink(event.dseq);

    return {
      summary: `Deployment ${event.dseq} is being reclaimed by the provider`,
      description:
        `The provider ${event.provider} has started reclaiming deployment ${event.dseq} because ${reasonText}. ` +
        `You have until ${deadline} to take action before the lease is closed. ` +
        `Please visit ${link} to manage your deployment.`
    };
  }

  private getConsoleLink(dseq: string): string {
    const baseUrl = this.configService.getOrThrow("alert.CONSOLE_WEB_URL");
    return `<a href="https://${baseUrl}/deployments/${dseq}">${baseUrl}</a>`;
  }
}
