import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import type { MockProxy } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import type { AlertConfig } from "@src/modules/alert/config";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import { ProviderActiveLeasesService } from "@src/modules/alert/services/provider-active-leases/provider-active-leases.service";
import { ProviderMaintenanceAlertService } from "@src/modules/alert/services/provider-maintenance-alert/provider-maintenance-alert.service";

import { MockProvider } from "@test/mocks/provider.mock";
import { generateGeneralAlert } from "@test/seeders/general-alert.seeder";

describe(ProviderMaintenanceAlertService.name, () => {
  it("does nothing when maintenance notifications are disabled", async () => {
    const { service, activeLeases, onMessage } = await setup({ enabled: false });

    await service.alertFor(EVENT, onMessage);

    expect(activeLeases.list).not.toHaveBeenCalled();
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("notifies an active lease through its enabled deployment alert channel", async () => {
    const { service, activeLeases, alertRepository, onMessage } = await setup();
    const alert = generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true });
    activeLeases.list.mockResolvedValue([LEASE]);
    alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(alert);
    alertRepository.claimProviderMaintenanceNotification.mockResolvedValue({ alert, claimId: CLAIM_ID });

    await service.alertFor(EVENT, onMessage);

    expect(alertRepository.claimProviderMaintenanceNotification).toHaveBeenCalledWith(alert.id, EVENT.provider, EVENT.maintenance_id, LEASE);
    expect(onMessage).toHaveBeenCalledWith({
      notificationChannelId: alert.notificationChannelId,
      payload: {
        summary: "Provider maintenance scheduled for deployment 100",
        description: expect.stringContaining("The lease remains open")
      }
    });
    expect(alertRepository.completeProviderMaintenanceNotification).toHaveBeenCalledWith(alert.id, EVENT.provider, EVENT.maintenance_id, LEASE, CLAIM_ID);
  });

  it("skips leases without an enabled deployment notification", async () => {
    const { service, activeLeases, alertRepository, onMessage } = await setup();
    activeLeases.list.mockResolvedValue([LEASE]);
    alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(generateGeneralAlert({ type: "CHAIN_EVENT", enabled: false }));

    await service.alertFor(EVENT, onMessage);

    expect(alertRepository.claimProviderMaintenanceNotification).not.toHaveBeenCalled();
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("skips a replay when the maintenance and lease tuple is already claimed", async () => {
    const { service, activeLeases, alertRepository, onMessage } = await setup();
    activeLeases.list.mockResolvedValue([LEASE]);
    alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true }));
    alertRepository.claimProviderMaintenanceNotification.mockResolvedValue(undefined);

    await service.alertFor(EVENT, onMessage);

    expect(onMessage).not.toHaveBeenCalled();
  });

  it("releases the claim when publishing fails so the broker can retry", async () => {
    const { service, activeLeases, alertRepository, onMessage } = await setup();
    const alert = generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true });
    activeLeases.list.mockResolvedValue([LEASE]);
    alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(alert);
    alertRepository.claimProviderMaintenanceNotification.mockResolvedValue({ alert, claimId: CLAIM_ID });
    onMessage.mockRejectedValue(new Error("publish failed"));

    await expect(service.alertFor(EVENT, onMessage)).rejects.toThrow("publish failed");

    expect(alertRepository.releaseProviderMaintenanceNotification).toHaveBeenCalledWith(alert.id, EVENT.provider, EVENT.maintenance_id, LEASE, CLAIM_ID);
    expect(alertRepository.completeProviderMaintenanceNotification).not.toHaveBeenCalled();
  });

  async function setup({ enabled = true }: { enabled?: boolean } = {}) {
    const configService = {
      getOrThrow: vi.fn((key: keyof AlertConfig) => {
        if (key === "alert.PROVIDER_MAINTENANCE_ALERTS_ENABLED") return enabled;
        if (key === "alert.CONSOLE_WEB_URL") return "console.akash.network";
        throw new Error(`Unexpected config key: ${key}`);
      })
    };
    const module = await Test.createTestingModule({
      providers: [
        ProviderMaintenanceAlertService,
        ProviderActiveLeasesService,
        MockProvider(AlertRepository),
        MockProvider(ProviderActiveLeasesService),
        MockProvider(LoggerService),
        { provide: ConfigService, useValue: configService }
      ]
    }).compile();

    return {
      service: module.get(ProviderMaintenanceAlertService),
      activeLeases: module.get<MockProxy<ProviderActiveLeasesService>>(ProviderActiveLeasesService),
      alertRepository: module.get<MockProxy<AlertRepository>>(AlertRepository),
      onMessage: vi.fn()
    };
  }
});

const EVENT = {
  module: "provider" as const,
  action: "provider-maintenance-opened" as const,
  maintenance_id: "17",
  provider: "akash1provideraddressxxxxxxxxxxxxxxxxxxxxxx",
  maintenance_type: "provider_maintenance_type_planned",
  starts_at: "2026-08-25T12:00:00Z",
  expected_ends_at: "2026-08-25T14:00:00Z"
};

const LEASE = {
  owner: "akash1owner1",
  dseq: "100",
  gseq: 1,
  oseq: 1,
  bseq: 3,
  provider: EVENT.provider
};

const CLAIM_ID = "b88f6777-7885-41b9-81ca-a601ea4d72f8";
