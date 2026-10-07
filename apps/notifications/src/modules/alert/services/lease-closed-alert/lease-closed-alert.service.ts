import { LeaseClosedReason } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { LoggerService } from "@src/common/services/logger/logger.service";
import type { AlertConfig } from "@src/modules/alert/config";
import type { GeneralAlertOutput } from "@src/modules/alert/repositories/alert/alert.repository";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import type { AlertMessagePayload } from "@src/modules/alert/services/alert-message/alert-message.service";
import { alertNotifiedLog } from "@src/modules/alert/services/alert-notified-log";
import { getLeaseClosedReasonText, toLeaseClosedReason } from "@src/modules/alert/services/reclaim-alert/lease-closed-reason";
import type { MessageCallback } from "@src/modules/alert/types/message-callback.type";

export interface LeaseClosedAlertEvent {
  owner: string;
  dseq: string;
  provider: string;
  reason: string | number;
}

@Injectable()
export class LeaseClosedAlertService {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly configService: ConfigService<AlertConfig>,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(LeaseClosedAlertService.name);
  }

  async alertFor(event: LeaseClosedAlertEvent, onMessage: MessageCallback): Promise<void> {
    const reason = toLeaseClosedReason(event.reason);

    if (reason === LeaseClosedReason.lease_closed_owner) {
      this.loggerService.debug({ event: "LEASE_CLOSED_ALERT_SKIPPED", reason: "CLOSED_BY_OWNER", owner: event.owner, dseq: event.dseq });
      return;
    }

    const alert = await this.alertRepository.findDeploymentClosedAlertByOwnerAndDseq(event.owner, event.dseq);

    if (!alert) {
      this.loggerService.debug({ event: "LEASE_CLOSED_ALERT_SKIPPED", reason: "NO_DEPLOYMENT_CLOSED_ALERT", owner: event.owner, dseq: event.dseq });
      return;
    }

    if (this.isOptedOut(alert)) {
      this.loggerService.debug({ event: "LEASE_CLOSED_ALERT_SKIPPED", reason: "OPTED_OUT", alertId: alert.id });
      return;
    }

    const claimedAlert = await this.alertRepository.claimNotification(alert.id, "leaseClosedNotifiedAt");

    if (!claimedAlert) {
      this.loggerService.debug({ event: "LEASE_CLOSED_ALERT_SKIPPED", reason: "ALREADY_NOTIFIED", alertId: alert.id });
      return;
    }

    await onMessage({
      notificationChannelId: claimedAlert.notificationChannelId,
      payload: this.buildMessage(event, reason)
    });

    this.loggerService.info(alertNotifiedLog(claimedAlert, { reason: "LEASE_CLOSED" }));
  }

  /** The deployment-closed alert switches itself off when it fires, and an insufficient-funds close can reach it first in the same block. */
  private isOptedOut(alert: GeneralAlertOutput): boolean {
    return !alert.enabled && !alert.params?.suppressedBySystem;
  }

  private buildMessage(event: LeaseClosedAlertEvent, reason: LeaseClosedReason): AlertMessagePayload {
    const link = this.getConsoleLink(event.dseq);

    return {
      summary: `The lease for deployment ${event.dseq} was closed`,
      description:
        `The lease for deployment ${event.dseq} with provider ${event.provider} was closed because ${getLeaseClosedReasonText(reason)}, ` +
        `so your workload is no longer running on that provider. ` +
        `Please visit ${link} to manage your deployment.`
    };
  }

  private getConsoleLink(dseq: string): string {
    const baseUrl = this.configService.getOrThrow("alert.CONSOLE_WEB_URL");
    return `<a href="https://${baseUrl}/deployments/${dseq}">${baseUrl}</a>`;
  }
}
