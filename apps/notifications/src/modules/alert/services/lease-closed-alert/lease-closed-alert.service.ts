import { LeaseClosedReason } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { Injectable } from "@nestjs/common";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { attemptEach } from "@src/lib/attempt-each/attempt-each";
import type { GeneralAlertOutput } from "@src/modules/alert/repositories/alert/alert.repository";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import { alertNotifiedLog } from "@src/modules/alert/services/alert-notified-log";
import { ClosureAlertService } from "@src/modules/alert/services/closure-alert/closure-alert.service";
import { toLeaseClosedReason } from "@src/modules/alert/services/reclaim-alert/lease-closed-reason";

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
    private readonly closureAlertService: ClosureAlertService,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(LeaseClosedAlertService.name);
  }

  async alertFor(event: LeaseClosedAlertEvent): Promise<void> {
    const reason = toLeaseClosedReason(event.reason);

    if (reason === LeaseClosedReason.lease_closed_owner) {
      this.loggerService.debug({ event: "LEASE_CLOSED_ALERT_SKIPPED", reason: "CLOSED_BY_OWNER", owner: event.owner, dseq: event.dseq });
      return;
    }

    const alerts = await this.alertRepository.findDeploymentClosedAlertsByOwnerAndDseq(event.owner, event.dseq);

    if (!alerts.length) {
      this.loggerService.debug({ event: "LEASE_CLOSED_ALERT_SKIPPED", reason: "NO_DEPLOYMENT_CLOSED_ALERT", owner: event.owner, dseq: event.dseq });
      return;
    }

    await attemptEach(
      alerts,
      alert => this.#recordFor(alert, event, reason),
      (alert, error) => this.loggerService.error({ event: "LEASE_CLOSED_ALERT_FAILED", alertId: alert.id, error })
    );
  }

  async #recordFor(alert: GeneralAlertOutput, event: LeaseClosedAlertEvent, reason: LeaseClosedReason): Promise<void> {
    if (this.isOptedOut(alert)) {
      this.loggerService.debug({ event: "LEASE_CLOSED_ALERT_SKIPPED", reason: "OPTED_OUT", alertId: alert.id });
      return;
    }

    const claimedAlert = await this.closureAlertService.recordLeaseClosure(alert, { owner: event.owner, dseq: event.dseq, provider: event.provider, reason });

    if (!claimedAlert) {
      this.loggerService.debug({ event: "LEASE_CLOSED_ALERT_SKIPPED", reason: "ALREADY_NOTIFIED", alertId: alert.id });
      return;
    }

    this.loggerService.info(alertNotifiedLog(claimedAlert, { reason: "LEASE_CLOSED" }));
  }

  /** The deployment-closed alert switches itself off when it fires, and an insufficient-funds close can reach it first in the same block. */
  private isOptedOut(alert: GeneralAlertOutput): boolean {
    return !alert.enabled && !alert.params?.suppressedBySystem;
  }
}
