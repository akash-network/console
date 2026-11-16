import { LeaseClosedReason } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LoggerService } from "@src/common/services/logger/logger.service";
import type { AlertRepository, GeneralAlertOutput } from "@src/modules/alert/repositories/alert/alert.repository";
import type { ClosureAlertService } from "@src/modules/alert/services/closure-alert/closure-alert.service";
import type { LeaseClosedAlertEvent } from "@src/modules/alert/services/lease-closed-alert/lease-closed-alert.service";
import { LeaseClosedAlertService } from "@src/modules/alert/services/lease-closed-alert/lease-closed-alert.service";

import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateGeneralAlert } from "@test/seeders/general-alert.seeder";

describe(LeaseClosedAlertService.name, () => {
  describe("alertFor", () => {
    it("skips a lease the owner closed without looking up alerts", async () => {
      const { service, alertRepository, closureAlertService, loggerService } = setup();
      const event = generateLeaseClosedEvent({ reason: "lease_closed_owner" });

      await service.alertFor(event);

      expect(alertRepository.findDeploymentClosedAlertsByOwnerAndDseq).not.toHaveBeenCalled();
      expect(closureAlertService.recordLeaseClosure).not.toHaveBeenCalled();
      expect(loggerService.debug).toHaveBeenCalledWith({ event: "LEASE_CLOSED_ALERT_SKIPPED", reason: "CLOSED_BY_OWNER", owner: event.owner, dseq: event.dseq });
    });

    it("skips when no deployment-closed alert exists for the owner and dseq", async () => {
      const { service, alertRepository, closureAlertService, loggerService } = setup();
      alertRepository.findDeploymentClosedAlertsByOwnerAndDseq.mockResolvedValue([]);
      const event = generateLeaseClosedEvent();

      await service.alertFor(event);

      expect(alertRepository.findDeploymentClosedAlertsByOwnerAndDseq).toHaveBeenCalledWith(event.owner, event.dseq);
      expect(closureAlertService.recordLeaseClosure).not.toHaveBeenCalled();
      expect(loggerService.debug).toHaveBeenCalledWith({
        event: "LEASE_CLOSED_ALERT_SKIPPED",
        reason: "NO_DEPLOYMENT_CLOSED_ALERT",
        owner: event.owner,
        dseq: event.dseq
      });
    });

    it("skips an alert the user switched off", async () => {
      const { service, alertRepository, closureAlertService, loggerService } = setup();
      const alert = generateDeploymentClosedAlert({ enabled: false });
      alertRepository.findDeploymentClosedAlertsByOwnerAndDseq.mockResolvedValue([alert]);

      await service.alertFor(generateLeaseClosedEvent());

      expect(closureAlertService.recordLeaseClosure).not.toHaveBeenCalled();
      expect(loggerService.debug).toHaveBeenCalledWith({ event: "LEASE_CLOSED_ALERT_SKIPPED", reason: "OPTED_OUT", alertId: alert.id });
    });

    it("records the lease closure with its reason for each alert of the deployment", async () => {
      const { service, alertRepository, closureAlertService, loggerService } = setup();
      const alert = generateDeploymentClosedAlert();
      const claimedAlert = { ...alert, notificationChannelId: "claimed-channel-id" };
      alertRepository.findDeploymentClosedAlertsByOwnerAndDseq.mockResolvedValue([alert]);
      closureAlertService.recordLeaseClosure.mockResolvedValue(claimedAlert);
      const event = generateLeaseClosedEvent({ reason: "lease_closed_reason_insufficient_funds" });

      await service.alertFor(event);

      expect(closureAlertService.recordLeaseClosure).toHaveBeenCalledWith(alert, {
        owner: event.owner,
        dseq: event.dseq,
        provider: event.provider,
        reason: LeaseClosedReason.lease_closed_reason_insufficient_funds
      });
      expect(loggerService.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: "ALERT_NOTIFIED", alertId: alert.id, notificationChannelId: "claimed-channel-id", reason: "LEASE_CLOSED" })
      );
    });

    it("records the lease closure when the deployment closed in the same block and switched its alert off", async () => {
      const { service, alertRepository, closureAlertService } = setup();
      const alert = generateDeploymentClosedAlert({ enabled: false, suppressedBySystem: true });
      alertRepository.findDeploymentClosedAlertsByOwnerAndDseq.mockResolvedValue([alert]);
      closureAlertService.recordLeaseClosure.mockResolvedValue(alert);

      await service.alertFor(generateLeaseClosedEvent());

      expect(closureAlertService.recordLeaseClosure).toHaveBeenCalledWith(alert, expect.anything());
    });

    it("logs an alert whose lease or reclaim notification was already claimed as skipped", async () => {
      const { service, alertRepository, closureAlertService, loggerService } = setup();
      const alert = generateDeploymentClosedAlert();
      alertRepository.findDeploymentClosedAlertsByOwnerAndDseq.mockResolvedValue([alert]);
      closureAlertService.recordLeaseClosure.mockResolvedValue(undefined);

      await service.alertFor(generateLeaseClosedEvent());

      expect(loggerService.debug).toHaveBeenCalledWith({ event: "LEASE_CLOSED_ALERT_SKIPPED", reason: "ALREADY_NOTIFIED", alertId: alert.id });
      expect(loggerService.info).not.toHaveBeenCalled();
    });

    it("still records the deployment's other alerts when one fails, then rejects so the event is redelivered", async () => {
      const { service, alertRepository, closureAlertService, loggerService } = setup();
      const failingAlert = generateDeploymentClosedAlert();
      const healthyAlert = generateDeploymentClosedAlert();
      const error = new Error("connection reset");
      alertRepository.findDeploymentClosedAlertsByOwnerAndDseq.mockResolvedValue([failingAlert, healthyAlert]);
      closureAlertService.recordLeaseClosure.mockRejectedValueOnce(error).mockResolvedValueOnce(healthyAlert);

      await expect(service.alertFor(generateLeaseClosedEvent())).rejects.toBe(error);

      expect(closureAlertService.recordLeaseClosure).toHaveBeenCalledWith(healthyAlert, expect.anything());
      expect(loggerService.error).toHaveBeenCalledWith({ event: "LEASE_CLOSED_ALERT_FAILED", alertId: failingAlert.id, error });
    });
  });

  function generateLeaseClosedEvent(overrides: Partial<LeaseClosedAlertEvent> = {}): LeaseClosedAlertEvent {
    return {
      owner: mockAkashAddress(),
      dseq: "12345",
      provider: mockAkashAddress(),
      reason: "lease_closed_reason_unstable",
      ...overrides
    };
  }

  function generateDeploymentClosedAlert(input: { enabled?: boolean; suppressedBySystem?: boolean } = {}): GeneralAlertOutput {
    return generateGeneralAlert({
      type: "CHAIN_EVENT",
      enabled: input.enabled ?? true,
      params: { dseq: "12345", type: "DEPLOYMENT_CLOSED", suppressedBySystem: input.suppressedBySystem }
    });
  }

  function setup() {
    const alertRepository = mock<AlertRepository>();
    const closureAlertService = mock<ClosureAlertService>();
    const loggerService = mock<LoggerService>();

    return {
      service: new LeaseClosedAlertService(alertRepository, closureAlertService, loggerService),
      alertRepository,
      closureAlertService,
      loggerService
    };
  }
});
