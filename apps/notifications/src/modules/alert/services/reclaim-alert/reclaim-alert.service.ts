import { Injectable } from "@nestjs/common";
import escape from "lodash/escape";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { type AlertOutput, AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import type { AlertMessagePayload } from "@src/modules/alert/services/alert-message/alert-message.service";
import { alertNotifiedLog } from "@src/modules/alert/services/alert-notified-log";
import { type DeploymentReference, DeploymentReferenceService } from "@src/modules/alert/services/deployment-reference/deployment-reference.service";
import { getLeaseClosedReasonText, toLeaseClosedReason } from "@src/modules/alert/services/reclaim-alert/lease-closed-reason";
import { formatReclaimDeadline } from "@src/modules/alert/services/reclaim-alert/reclaim-deadline";
import type { MessageCallback } from "@src/modules/alert/types/message-callback.type";
import type { AlertFeedEntry } from "@src/modules/notifications/dto/NotificationCommand.dto";

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
    private readonly deploymentReferenceService: DeploymentReferenceService,
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

    const recipientTimezone = await this.alertRepository.findNotificationChannelTimezone(alert.notificationChannelId);
    const deployment = await this.deploymentReferenceService.referTo({ owner: event.owner, dseq: event.dseq, organizationId: alert.organizationId });
    const claimedAlert = await this.alertRepository.claimNotification(alert.id, "reclaimNotifiedAt");

    if (!claimedAlert) {
      this.loggerService.debug({ event: "RECLAIM_ALERT_SKIPPED", reason: "ALREADY_NOTIFIED", alertId: alert.id });
      return;
    }

    await onMessage({
      notificationChannelId: claimedAlert.notificationChannelId,
      payload: { ...this.buildMessage(event, deployment, recipientTimezone), feedEntry: feedEntryOf(claimedAlert, event.dseq) }
    });

    this.loggerService.info(alertNotifiedLog(claimedAlert, { reason: "RECLAIM_DEADLINE" }));
  }

  private buildMessage(event: ReclaimAlertEvent, { label, link }: DeploymentReference, recipientTimezone: string | null): AlertMessagePayload {
    const reasonText = getLeaseClosedReasonText(toLeaseClosedReason(event.reason));
    const deadline = formatReclaimDeadline(Number(event.deadline), Date.now(), recipientTimezone);

    return {
      summary: `Deployment ${label} is being reclaimed by the provider`,
      description:
        `The provider ${event.provider} has started reclaiming deployment ${escape(label)} because ${reasonText}. ` +
        `You have until ${deadline} to take action before the lease is closed. ` +
        `Please visit ${link} to manage your deployment.`
    };
  }
}

/** The claim on the alert lets one reclaim notice out per deployment-closed alert, so the alert's id names that notice. */
function feedEntryOf({ id, userId, organizationId, projectId }: AlertOutput, dseq: string): AlertFeedEntry {
  return { type: "deployment_reclaim_alert", alertId: id, userId, organizationId, projectId, dedupeKey: `deployment_reclaim_alert.${id}`, dseq };
}
