import type { LeaseClosedReason } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { addSeconds, subSeconds } from "date-fns";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { LoggerService } from "@src/common/services/logger/logger.service";
import { BrokerService } from "@src/infrastructure/broker/services/broker/broker.service";
import type { AlertConfig } from "@src/modules/alert/config";
import { type AlertOutput, AlertRepository, type GeneralAlertOutput } from "@src/modules/alert/repositories/alert/alert.repository";
import {
  type ChannelClosureState,
  type ClosureNoticeInput,
  ClosureNoticeRepository
} from "@src/modules/alert/repositories/closure-notice/closure-notice.repository";
import { DeploymentReferenceService } from "@src/modules/alert/services/deployment-reference/deployment-reference.service";
import { ProviderHostService } from "@src/modules/alert/services/provider-host/provider-host.service";
import { toClosureEmail } from "./closure-alert-email";

export type ClosedDeployment = {
  owner: string;
  dseq: string;
};

export type ClosedLease = ClosedDeployment & {
  provider: string;
  reason: LeaseClosedReason;
};

@Injectable()
export class ClosureAlertService {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly closureNoticeRepository: ClosureNoticeRepository,
    private readonly deploymentReferenceService: DeploymentReferenceService,
    private readonly providerHostService: ProviderHostService,
    private readonly brokerService: BrokerService,
    private readonly configService: ConfigService<AlertConfig>,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(ClosureAlertService.name);
  }

  async recordDeploymentClosure(alert: GeneralAlertOutput, deployment: ClosedDeployment): Promise<void> {
    await this.closureNoticeRepository.record(await this.#noticeOf(alert, deployment, true));
    await this.#scheduleFlush(alert.notificationChannelId);
  }

  /** A lease that closes after its deployment's closure was emailed adds nothing, and the flush is scheduled even when the claim was taken, so a redelivered event still sends a notice whose scheduling failed. */
  async recordLeaseClosure(alert: GeneralAlertOutput, lease: ClosedLease): Promise<AlertOutput | undefined> {
    const [notice, providerLabel] = await Promise.all([this.#noticeOf(alert, lease, false), this.providerHostService.labelFor(lease.provider)]);
    const claimedAlert = await this.closureNoticeRepository.transaction(async tx => {
      const claimed = await this.alertRepository.claimNotification(alert.id, "leaseClosedNotifiedAt", tx);

      if (!claimed) return undefined;

      if (!(await this.closureNoticeRepository.hasSentDeploymentClosure(claimed.id, tx))) {
        await this.closureNoticeRepository.record({ ...notice, providerLabel, leaseClosedReason: lease.reason, notificationChannelId: claimed.notificationChannelId }, tx);
      }

      return claimed;
    });

    await this.#scheduleFlush(claimedAlert?.notificationChannelId ?? alert.notificationChannelId);

    return claimedAlert;
  }

  async flush(notificationChannelId: string): Promise<void> {
    const now = new Date();

    await this.closureNoticeRepository.lockingChannel(notificationChannelId, async tx => {
      const flushAt = this.#flushTimeOf(await this.closureNoticeRepository.findChannelState(notificationChannelId, tx));

      if (!flushAt || flushAt > now) return;

      const notices = await this.closureNoticeRepository.claimPending(notificationChannelId, { createdUpTo: subSeconds(now, this.#holdSeconds), sentAt: now }, tx);
      const { category, payload } = toClosureEmail(notices);
      await this.brokerService.publish(eventKeyRegistry.createNotification, { notificationChannelId, category, payload });

      this.loggerService.info({ event: "CLOSURE_ALERTS_SENT", notificationChannelId, category, noticeCount: notices.length });
    });

    await this.#scheduleFlush(notificationChannelId);
    await this.closureNoticeRepository.deleteSentBefore(subSeconds(now, this.#digestWindowSeconds));
  }

  async #noticeOf(alert: GeneralAlertOutput, { owner, dseq }: ClosedDeployment, deploymentClosed: boolean): Promise<ClosureNoticeInput> {
    const { userId, organizationId, projectId } = alert;
    const { label, link } = await this.deploymentReferenceService.referTo({ owner, dseq, userId, organizationId, tab: "SETTINGS" });

    return {
      alertId: alert.id,
      notificationChannelId: alert.notificationChannelId,
      userId,
      organizationId,
      projectId,
      owner,
      dseq,
      deploymentLabel: label,
      deploymentLink: link,
      deploymentClosed,
      createdAt: new Date()
    };
  }

  /** The singleton key keeps one queued flush per channel, so a burst of closures schedules it once. */
  async #scheduleFlush(notificationChannelId: string): Promise<void> {
    const flushAt = this.#flushTimeOf(await this.closureNoticeRepository.findChannelState(notificationChannelId));

    if (!flushAt) return;

    await this.brokerService.publish(eventKeyRegistry.closureAlertsDue, { notificationChannelId }, { singletonKey: notificationChannelId, startAfter: flushAt });
  }

  /** Holds every closure long enough to merge its deployment's other closure events, and a channel that just got a closure email until its digest window is over. */
  #flushTimeOf({ oldestPendingAt, lastSentAt }: ChannelClosureState): Date | undefined {
    if (!oldestPendingAt) return undefined;

    const heldUntil = addSeconds(oldestPendingAt, this.#holdSeconds);
    const digestDueAt = lastSentAt && addSeconds(lastSentAt, this.#digestWindowSeconds);

    return digestDueAt && digestDueAt > heldUntil ? digestDueAt : heldUntil;
  }

  get #holdSeconds(): number {
    return this.configService.getOrThrow("alert.CLOSURE_ALERT_HOLD_SECONDS");
  }

  get #digestWindowSeconds(): number {
    return this.configService.getOrThrow("alert.CLOSURE_ALERT_DIGEST_WINDOW_SECONDS");
  }
}

