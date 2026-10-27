import { LeaseClosedReason } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { Injectable } from "@nestjs/common";
import escape from "lodash/escape";

import { LoggerService } from "@src/common/services/logger/logger.service";
import type { GeneralAlertOutput } from "@src/modules/alert/repositories/alert/alert.repository";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import type { AlertMessagePayload } from "@src/modules/alert/services/alert-message/alert-message.service";
import { alertNotifiedLog } from "@src/modules/alert/services/alert-notified-log";
import { type DeploymentReference, DeploymentReferenceService } from "@src/modules/alert/services/deployment-reference/deployment-reference.service";
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
    private readonly deploymentReferenceService: DeploymentReferenceService,
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

    const deployment = await this.deploymentReferenceService.referTo({
      owner: event.owner,
      dseq: event.dseq,
      userId: alert.userId,
      organizationId: alert.organizationId
    });
    const claimedAlert = await this.alertRepository.claimNotification(alert.id, "leaseClosedNotifiedAt");

    if (!claimedAlert) {
      this.loggerService.debug({ event: "LEASE_CLOSED_ALERT_SKIPPED", reason: "ALREADY_NOTIFIED", alertId: alert.id });
      return;
    }

    await onMessage({
      notificationChannelId: claimedAlert.notificationChannelId,
      payload: this.buildMessage(event, deployment, reason)
    });

    this.loggerService.info(alertNotifiedLog(claimedAlert, { reason: "LEASE_CLOSED" }));
  }

  /** The deployment-closed alert switches itself off when it fires, and an insufficient-funds close can reach it first in the same block. */
  private isOptedOut(alert: GeneralAlertOutput): boolean {
    return !alert.enabled && !alert.params?.suppressedBySystem;
  }

  private buildMessage(event: LeaseClosedAlertEvent, { label, link }: DeploymentReference, reason: LeaseClosedReason): AlertMessagePayload {
    return {
      summary: `The lease for deployment ${label} was closed`,
      description:
        `The lease for deployment ${escape(label)} with provider ${event.provider} was closed because ${getLeaseClosedReasonText(reason)}, ` +
        `so your workload is no longer running on that provider. ` +
        `Please visit ${link} to manage your deployment.`
    };
  }
}
