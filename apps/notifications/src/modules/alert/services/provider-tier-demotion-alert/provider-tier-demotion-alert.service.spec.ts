import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MockProxy } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { BrokerService } from "@src/infrastructure/broker";
import type { AlertConfig } from "@src/modules/alert/config";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import { ProviderTierDemotionRepository } from "@src/modules/alert/repositories/provider-tier-demotion/provider-tier-demotion.repository";
import { ProviderActiveLeasesService } from "@src/modules/alert/services/provider-active-leases/provider-active-leases.service";
import { ProviderTierDemotionAlertService } from "@src/modules/alert/services/provider-tier-demotion-alert/provider-tier-demotion-alert.service";
import { ProviderTierDemotionFeedService } from "@src/modules/alert/services/provider-tier-demotion-feed/provider-tier-demotion-feed.service";
import type { ProviderTierDemotionFeed } from "@src/modules/alert/types/provider-tier-demotion.type";

import { MockProvider } from "@test/mocks/provider.mock";
import { generateGeneralAlert } from "@test/seeders/general-alert.seeder";

describe(ProviderTierDemotionAlertService.name, () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does not poll when the feature is disabled", async () => {
    const { service, repository, feedService } = await setup({ enabled: false });

    await service.processNextPage();

    expect(repository.claimFeed).not.toHaveBeenCalled();
    expect(feedService.get).not.toHaveBeenCalled();
  });

  it.each([
    ["first observation", null],
    ["stream reset", OLD_STREAM_ID]
  ])("moves to the feed head without alerting on %s", async (_, streamId) => {
    const { service, repository, feedService, activeLeases, brokerService } = await setup();
    repository.claimFeed.mockResolvedValue({ claimId: FEED_CLAIM_ID, streamId, cursor: "0" });
    feedService.get.mockResolvedValue(FEED);

    await service.processNextPage();

    expect(repository.setFeedPosition).toHaveBeenCalledWith(FEED_CLAIM_ID, STREAM_ID, "12");
    expect(activeLeases.list).not.toHaveBeenCalled();
    expect(brokerService.publish).not.toHaveBeenCalled();
    expect(repository.releaseFeed).toHaveBeenCalledWith(FEED_CLAIM_ID);
  });

  it("silently advances to the head while the verification module is inactive", async () => {
    const { service, repository, feedService, activeLeases, brokerService } = await setup();
    repository.claimFeed.mockResolvedValue(FEED_CLAIM);
    feedService.get.mockResolvedValue({ ...FEED, moduleActive: false });

    await service.processNextPage();

    expect(repository.setFeedPosition).toHaveBeenCalledWith(FEED_CLAIM_ID, STREAM_ID, "12");
    expect(activeLeases.list).not.toHaveBeenCalled();
    expect(brokerService.publish).not.toHaveBeenCalled();
  });

  it("publishes once for an active lease and advances only after delivery completes", async () => {
    const { service, repository, feedService, activeLeases, alertRepository, brokerService } = await setup();
    const alert = generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true });
    repository.claimFeed.mockResolvedValue(FEED_CLAIM);
    repository.claimDelivery.mockResolvedValue({ status: "claimed", claimId: DELIVERY_CLAIM_ID });
    feedService.get.mockResolvedValue(FEED);
    activeLeases.list.mockResolvedValue([LEASE]);
    alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(alert);

    await service.processNextPage();

    const delivery = {
      streamId: STREAM_ID,
      cursor: "11",
      alertId: alert.id,
      provider: PROVIDER,
      lease: LEASE
    };
    expect(repository.claimDelivery).toHaveBeenCalledWith(delivery);
    expect(brokerService.publish).toHaveBeenCalledWith(
      "notifications.v1.notification.create",
      {
        notificationChannelId: alert.notificationChannelId,
        payload: {
          summary: "Provider verification changed for deployment 100",
          description: expect.stringContaining("The existing lease remains open")
        }
      },
      { id: expect.stringMatching(/^[0-9a-f-]{36}$/) }
    );
    expect(repository.completeDelivery).toHaveBeenCalledWith(delivery, DELIVERY_CLAIM_ID);
    expect(repository.advanceFeed).toHaveBeenCalledWith(FEED_CLAIM_ID, STREAM_ID, "11");
    expect(repository.completeDelivery.mock.invocationCallOrder[0]).toBeLessThan(repository.advanceFeed.mock.invocationCallOrder[0]);
  });

  it("skips a delivery already marked sent and still advances the cursor", async () => {
    const { service, repository, feedService, activeLeases, alertRepository, brokerService } = await setup();
    repository.claimFeed.mockResolvedValue(FEED_CLAIM);
    repository.claimDelivery.mockResolvedValue({ status: "sent" });
    feedService.get.mockResolvedValue(FEED);
    activeLeases.list.mockResolvedValue([LEASE]);
    alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true }));

    await service.processNextPage();

    expect(brokerService.publish).not.toHaveBeenCalled();
    expect(repository.advanceFeed).toHaveBeenCalledWith(FEED_CLAIM_ID, STREAM_ID, "11");
  });

  it("does not advance when another worker still owns a delivery", async () => {
    const { service, repository, feedService, activeLeases, alertRepository } = await setup();
    repository.claimFeed.mockResolvedValue(FEED_CLAIM);
    repository.claimDelivery.mockResolvedValue({ status: "busy" });
    feedService.get.mockResolvedValue(FEED);
    activeLeases.list.mockResolvedValue([LEASE]);
    alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true }));

    await expect(service.processNextPage()).rejects.toThrow("already being processed");

    expect(repository.advanceFeed).not.toHaveBeenCalled();
    expect(repository.releaseFeed).toHaveBeenCalledWith(FEED_CLAIM_ID);
  });

  it("releases a failed delivery, keeps the cursor, and reuses the broker job id on retry", async () => {
    const { service, repository, feedService, activeLeases, alertRepository, brokerService } = await setup();
    const alert = generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true });
    repository.claimFeed.mockResolvedValue(FEED_CLAIM);
    repository.claimDelivery.mockResolvedValueOnce({ status: "claimed", claimId: DELIVERY_CLAIM_ID }).mockResolvedValueOnce({
      status: "claimed",
      claimId: SECOND_DELIVERY_CLAIM_ID
    });
    feedService.get.mockResolvedValue(FEED);
    activeLeases.list.mockResolvedValue([LEASE]);
    alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(alert);
    brokerService.publish.mockRejectedValueOnce(new Error("publish failed")).mockResolvedValueOnce();

    await expect(service.processNextPage()).rejects.toThrow("publish failed");
    expect(repository.advanceFeed).not.toHaveBeenCalled();
    expect(repository.releaseDelivery).toHaveBeenCalledWith(expect.anything(), DELIVERY_CLAIM_ID);

    await service.processNextPage();

    expect(brokerService.publish).toHaveBeenCalledTimes(2);
    expect(brokerService.publish.mock.calls[0][2]?.id).toBe(brokerService.publish.mock.calls[1][2]?.id);
    expect(repository.advanceFeed).toHaveBeenCalledWith(FEED_CLAIM_ID, STREAM_ID, "11");
  });

  async function setup({ enabled = true }: { enabled?: boolean } = {}) {
    const configService = {
      get: vi.fn(),
      getOrThrow: vi.fn((key: keyof AlertConfig) => {
        if (key === "alert.PROVIDER_TIER_DEMOTION_ALERTS_ENABLED") return enabled;
        if (key === "alert.CONSOLE_WEB_URL") return "console.akash.network";
        if (key === "alert.PROVIDER_TIER_DEMOTION_POLL_INTERVAL_MS") return 15000;
        throw new Error(`Unexpected config key: ${key}`);
      })
    };
    const module = await Test.createTestingModule({
      providers: [
        ProviderTierDemotionAlertService,
        MockProvider(ProviderTierDemotionFeedService),
        MockProvider(ProviderTierDemotionRepository),
        MockProvider(ProviderActiveLeasesService),
        MockProvider(AlertRepository),
        MockProvider(BrokerService),
        MockProvider(LoggerService),
        { provide: ConfigService, useValue: configService }
      ]
    }).compile();

    return {
      service: module.get(ProviderTierDemotionAlertService),
      feedService: module.get<MockProxy<ProviderTierDemotionFeedService>>(ProviderTierDemotionFeedService),
      repository: module.get<MockProxy<ProviderTierDemotionRepository>>(ProviderTierDemotionRepository),
      activeLeases: module.get<MockProxy<ProviderActiveLeasesService>>(ProviderActiveLeasesService),
      alertRepository: module.get<MockProxy<AlertRepository>>(AlertRepository),
      brokerService: module.get<MockProxy<BrokerService>>(BrokerService)
    };
  }
});

const STREAM_ID = "5be32550-fbc2-4f02-9ac2-7d58f0362451";
const OLD_STREAM_ID = "28d32c3f-38a0-43e5-a07a-d8c1d6b99203";
const FEED_CLAIM_ID = "0d29d7ce-41fc-4c4a-bd33-a1bcbf296e4d";
const DELIVERY_CLAIM_ID = "e6e6d36c-86c6-4da2-8b5a-86ca83b780ee";
const SECOND_DELIVERY_CLAIM_ID = "9e4c6ef0-3577-4b56-98a7-ae6068f0e98e";
const PROVIDER = "akash1provideraddressxxxxxxxxxxxxxxxxxxxxxx";

const FEED_CLAIM = { claimId: FEED_CLAIM_ID, streamId: STREAM_ID, cursor: "10" };
const LEASE = { owner: "akash1owner1", dseq: "100", gseq: 1, oseq: 1, bseq: 3, provider: PROVIDER };
const FEED: ProviderTierDemotionFeed = {
  streamId: STREAM_ID,
  headCursor: "12",
  nextCursor: "11",
  moduleActive: true,
  items: [
    {
      cursor: "11",
      provider: PROVIDER,
      previous: { effectiveTier: "L3", maxPlacementTier: "L3", snapshotState: "current" },
      current: { effectiveTier: "L1", maxPlacementTier: "L1", snapshotState: "stale" },
      changes: ["tier_gate", "snapshot_eligibility"],
      observedHeight: "12345",
      observedAt: "2026-08-25T00:00:00.000Z"
    }
  ]
};
