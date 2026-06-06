import { LeaseClosedReason } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import type { MockProxy } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import moduleConfig from "@src/modules/alert/config";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import type { ReclaimAlertEvent } from "@src/modules/alert/services/reclaim-alert/reclaim-alert.service";
import { ReclaimAlertService } from "@src/modules/alert/services/reclaim-alert/reclaim-alert.service";

import { MockProvider } from "@test/mocks/provider.mock";
import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateGeneralAlert } from "@test/seeders/general-alert.seeder";

describe(ReclaimAlertService.name, () => {
  describe("alertFor", () => {
    it("skips when no deployment-closed alert exists for the owner and dseq", async () => {
      const { service, alertRepository, onMessage } = await setup();
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(undefined);

      await service.alertFor(generateReclaimEvent(), onMessage);

      expect(alertRepository.claimReclaimNotification).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
    });

    it("skips when the deployment-closed alert is disabled (opted out)", async () => {
      const { service, alertRepository, onMessage } = await setup();
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(generateGeneralAlert({ type: "CHAIN_EVENT", enabled: false }));

      await service.alertFor(generateReclaimEvent(), onMessage);

      expect(alertRepository.claimReclaimNotification).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
    });

    it("skips when the reclaim notification was already claimed", async () => {
      const { service, alertRepository, onMessage } = await setup();
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true }));
      alertRepository.claimReclaimNotification.mockResolvedValue(undefined);

      await service.alertFor(generateReclaimEvent(), onMessage);

      expect(onMessage).not.toHaveBeenCalled();
    });

    it("claims then sends exactly one notification to the alert's channel", async () => {
      const { service, alertRepository, onMessage } = await setup();
      const alert = generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true });
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(alert);
      alertRepository.claimReclaimNotification.mockResolvedValue(alert);

      await service.alertFor(generateReclaimEvent({ dseq: "12345" }), onMessage);

      expect(alertRepository.claimReclaimNotification).toHaveBeenCalledWith(alert.id);
      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationChannelId: alert.notificationChannelId,
          payload: {
            summary: expect.stringContaining("12345"),
            description: expect.any(String)
          }
        })
      );
    });

    it("includes the provider, reason, deadline and deep link in the message", async () => {
      const { service, alertRepository, onMessage } = await setup();
      const alert = generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true });
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(alert);
      alertRepository.claimReclaimNotification.mockResolvedValue(alert);
      const provider = mockAkashAddress();

      await service.alertFor(
        generateReclaimEvent({ dseq: "12345", provider, reason: LeaseClosedReason.lease_closed_reason_unstable, deadline: 1749398400 }),
        onMessage
      );

      const { description } = onMessage.mock.calls[0][0].payload;
      expect(description).toContain(provider);
      expect(description).toContain("the workload has been unstable");
      expect(description).toContain("2025-06-08");
      expect(description).toContain("/deployments/12345");
    });
  });

  function generateReclaimEvent(overrides: Partial<ReclaimAlertEvent> = {}): ReclaimAlertEvent {
    return {
      owner: mockAkashAddress(),
      dseq: "12345",
      provider: mockAkashAddress(),
      reason: LeaseClosedReason.lease_closed_reason_unstable,
      deadline: 1749398400,
      ...overrides
    };
  }

  async function setup() {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forFeature(moduleConfig)],
      providers: [ReclaimAlertService, MockProvider(AlertRepository), MockProvider(LoggerService)]
    }).compile();

    return {
      service: module.get<ReclaimAlertService>(ReclaimAlertService),
      alertRepository: module.get<MockProxy<AlertRepository>>(AlertRepository),
      onMessage: vi.fn()
    };
  }
});
