import { ConfigModule, ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import type { MockProxy } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import type { AlertConfig } from "@src/modules/alert/config";
import moduleConfig from "@src/modules/alert/config";
import type { GeneralAlertOutput } from "@src/modules/alert/repositories/alert/alert.repository";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import type { LeaseClosedAlertEvent } from "@src/modules/alert/services/lease-closed-alert/lease-closed-alert.service";
import { LeaseClosedAlertService } from "@src/modules/alert/services/lease-closed-alert/lease-closed-alert.service";

import { MockProvider } from "@test/mocks/provider.mock";
import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateGeneralAlert } from "@test/seeders/general-alert.seeder";

describe(LeaseClosedAlertService.name, () => {
  describe("alertFor", () => {
    it("skips a lease the owner closed without looking up alerts", async () => {
      const { service, alertRepository, loggerService, onMessage } = await setup();
      const event = generateLeaseClosedEvent({ reason: "lease_closed_owner" });

      await service.alertFor(event, onMessage);

      expect(alertRepository.findDeploymentClosedAlertByOwnerAndDseq).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
      expect(loggerService.debug).toHaveBeenCalledWith({
        event: "LEASE_CLOSED_ALERT_SKIPPED",
        reason: "CLOSED_BY_OWNER",
        owner: event.owner,
        dseq: event.dseq
      });
    });

    it("skips when no deployment-closed alert exists for the owner and dseq", async () => {
      const { service, alertRepository, loggerService, onMessage } = await setup();
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(undefined);
      const event = generateLeaseClosedEvent();

      await service.alertFor(event, onMessage);

      expect(alertRepository.findDeploymentClosedAlertByOwnerAndDseq).toHaveBeenCalledWith(event.owner, event.dseq);
      expect(alertRepository.claimNotification).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
      expect(loggerService.debug).toHaveBeenCalledWith({
        event: "LEASE_CLOSED_ALERT_SKIPPED",
        reason: "NO_DEPLOYMENT_CLOSED_ALERT",
        owner: event.owner,
        dseq: event.dseq
      });
    });

    it("skips when the user switched the deployment-closed alert off", async () => {
      const { service, alertRepository, loggerService, onMessage } = await setup();
      const alert = generateDeploymentClosedAlert({ enabled: false });
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(alert);

      await service.alertFor(generateLeaseClosedEvent(), onMessage);

      expect(alertRepository.claimNotification).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
      expect(loggerService.debug).toHaveBeenCalledWith({ event: "LEASE_CLOSED_ALERT_SKIPPED", reason: "OPTED_OUT", alertId: alert.id });
    });

    it("skips when this or the reclaim notification was already claimed", async () => {
      const { service, alertRepository, loggerService, onMessage } = await setup();
      const alert = generateDeploymentClosedAlert();
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(alert);
      alertRepository.claimNotification.mockResolvedValue(undefined);

      await service.alertFor(generateLeaseClosedEvent(), onMessage);

      expect(onMessage).not.toHaveBeenCalled();
      expect(loggerService.debug).toHaveBeenCalledWith({ event: "LEASE_CLOSED_ALERT_SKIPPED", reason: "ALREADY_NOTIFIED", alertId: alert.id });
    });

    it("claims then sends one notification to the claimed alert's channel", async () => {
      const { service, alertRepository, loggerService, onMessage } = await setup();
      const alert = generateDeploymentClosedAlert();
      const claimedAlert = { ...alert, notificationChannelId: "claimed-channel-id" };
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(alert);
      alertRepository.claimNotification.mockResolvedValue(claimedAlert);

      await service.alertFor(generateLeaseClosedEvent(), onMessage);

      expect(alertRepository.claimNotification).toHaveBeenCalledWith(alert.id, "leaseClosedNotifiedAt");
      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ notificationChannelId: "claimed-channel-id" }));
      expect(loggerService.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: "ALERT_NOTIFIED", alertId: alert.id, notificationChannelId: "claimed-channel-id", reason: "LEASE_CLOSED" })
      );
    });

    it("still notifies when the deployment closed in the same block and switched its alert off", async () => {
      const { service, alertRepository, onMessage } = await setup();
      const alert = generateDeploymentClosedAlert({ enabled: false, suppressedBySystem: true });
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(alert);
      alertRepository.claimNotification.mockResolvedValue(alert);

      await service.alertFor(generateLeaseClosedEvent({ reason: "lease_closed_reason_insufficient_funds" }), onMessage);

      expect(onMessage).toHaveBeenCalledTimes(1);
    });

    it("names the deployment, the provider and the close reason, and links to the deployment", async () => {
      const { service, alertRepository, onMessage, consoleWebUrl } = await setup();
      const alert = generateDeploymentClosedAlert();
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(alert);
      alertRepository.claimNotification.mockResolvedValue(alert);
      const provider = mockAkashAddress();

      await service.alertFor(generateLeaseClosedEvent({ dseq: "12345", provider, reason: "lease_closed_reason_manifest_timeout" }), onMessage);

      expect(onMessage.mock.calls[0][0].payload).toEqual({
        summary: "The lease for deployment 12345 was closed",
        description:
          `The lease for deployment 12345 with provider ${provider} was closed because the manifest was not received in time, ` +
          `so your workload is no longer running on that provider. ` +
          `Please visit <a href="https://${consoleWebUrl}/deployments/12345">${consoleWebUrl}</a> to manage your deployment.`
      });
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
      params: {
        dseq: "12345",
        type: "DEPLOYMENT_CLOSED",
        suppressedBySystem: input.suppressedBySystem
      }
    });
  }

  async function setup() {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forFeature(moduleConfig)],
      providers: [LeaseClosedAlertService, MockProvider(AlertRepository), MockProvider(LoggerService)]
    }).compile();

    return {
      service: module.get<LeaseClosedAlertService>(LeaseClosedAlertService),
      alertRepository: module.get<MockProxy<AlertRepository>>(AlertRepository),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
      consoleWebUrl: module.get<ConfigService<AlertConfig>>(ConfigService).getOrThrow("alert.CONSOLE_WEB_URL"),
      onMessage: vi.fn()
    };
  }
});
