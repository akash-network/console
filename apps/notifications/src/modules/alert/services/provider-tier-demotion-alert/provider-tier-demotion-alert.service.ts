import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { LoggerService } from "@src/common/services/logger/logger.service";
import { BrokerService } from "@src/infrastructure/broker";
import type { AlertConfig } from "@src/modules/alert/config";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import {
  type ProviderTierDemotionDelivery,
  ProviderTierDemotionRepository
} from "@src/modules/alert/repositories/provider-tier-demotion/provider-tier-demotion.repository";
import { ProviderActiveLeasesService } from "@src/modules/alert/services/provider-active-leases/provider-active-leases.service";
import { ProviderTierDemotionFeedService } from "@src/modules/alert/services/provider-tier-demotion-feed/provider-tier-demotion-feed.service";
import type { ProviderLeaseId } from "@src/modules/alert/types/provider-lease.type";
import type { ProviderTierDemotion } from "@src/modules/alert/types/provider-tier-demotion.type";

@Injectable()
export class ProviderTierDemotionAlertService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly abortController = new AbortController();
  private polling?: Promise<void>;

  constructor(
    private readonly feedService: ProviderTierDemotionFeedService,
    private readonly repository: ProviderTierDemotionRepository,
    private readonly activeLeases: ProviderActiveLeasesService,
    private readonly alertRepository: AlertRepository,
    private readonly brokerService: BrokerService,
    private readonly configService: ConfigService<AlertConfig>,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(ProviderTierDemotionAlertService.name);
  }

  onApplicationBootstrap(): void {
    if (!this.configService.getOrThrow("alert.PROVIDER_TIER_DEMOTION_ALERTS_ENABLED")) return;

    this.polling = this.pollLoop();
  }

  async processNextPage(signal: AbortSignal = this.abortController.signal): Promise<void> {
    if (!this.configService.getOrThrow("alert.PROVIDER_TIER_DEMOTION_ALERTS_ENABLED")) return;

    const claim = await this.repository.claimFeed();
    if (!claim) return;

    try {
      const feed = await this.feedService.get(claim.cursor, signal);

      if (!claim.streamId || claim.streamId !== feed.streamId || !feed.moduleActive) {
        await this.repository.setFeedPosition(claim.claimId, feed.streamId, feed.headCursor);
        return;
      }

      let cursor = BigInt(claim.cursor);
      for (const demotion of feed.items) {
        const nextCursor = BigInt(demotion.cursor);
        if (nextCursor <= cursor) throw new Error("Provider tier-demotion feed cursors must increase monotonically");

        await this.processDemotion(feed.streamId, demotion);
        await this.repository.advanceFeed(claim.claimId, feed.streamId, demotion.cursor);
        cursor = nextCursor;
      }
    } finally {
      await this.repository.releaseFeed(claim.claimId);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.abortController.abort();
    await this.polling;
  }

  private async pollLoop(): Promise<void> {
    while (!this.abortController.signal.aborted) {
      try {
        await this.processNextPage();
      } catch (error) {
        if (!this.abortController.signal.aborted) {
          this.loggerService.error({ event: "PROVIDER_TIER_DEMOTION_POLL_FAILED", error });
        }
      }

      await delay(this.configService.getOrThrow("alert.PROVIDER_TIER_DEMOTION_POLL_INTERVAL_MS"), undefined, {
        signal: this.abortController.signal
      }).catch(error => (error?.name === "AbortError" ? undefined : Promise.reject(error)));
    }
  }

  private async processDemotion(streamId: string, demotion: ProviderTierDemotion): Promise<void> {
    const leases = await this.activeLeases.list(demotion.provider);
    await Promise.all(leases.map(lease => this.processLease(streamId, demotion, lease)));
  }

  private async processLease(streamId: string, demotion: ProviderTierDemotion, lease: ProviderLeaseId): Promise<void> {
    const alert = await this.alertRepository.findDeploymentClosedAlertByOwnerAndDseq(lease.owner, lease.dseq);
    if (!alert?.enabled) return;

    const delivery: ProviderTierDemotionDelivery = {
      streamId,
      cursor: demotion.cursor,
      alertId: alert.id,
      provider: demotion.provider,
      lease
    };
    const claim = await this.repository.claimDelivery(delivery);
    if (claim.status === "sent") return;
    if (claim.status === "busy") throw new Error("Provider tier-demotion delivery is already being processed");

    try {
      await this.brokerService.publish(
        eventKeyRegistry.createNotification,
        {
          notificationChannelId: alert.notificationChannelId,
          payload: {
            summary: `Provider verification changed for deployment ${lease.dseq}`,
            description: this.description(demotion, lease)
          }
        },
        { id: this.deliveryId(delivery) }
      );
      await this.repository.completeDelivery(delivery, claim.claimId);
    } catch (error) {
      await this.repository.releaseDelivery(delivery, claim.claimId);
      throw error;
    }
  }

  private description(demotion: ProviderTierDemotion, lease: ProviderLeaseId): string {
    const baseUrl = this.configService.getOrThrow("alert.CONSOLE_WEB_URL");
    const link = `<a href="https://${baseUrl}/deployments/${lease.dseq}">${baseUrl}</a>`;
    const tierChange =
      demotion.previous.effectiveTier === demotion.current.effectiveTier
        ? `Provider ${demotion.provider} verification eligibility changed.`
        : `Provider ${demotion.provider} verification tier changed from ${demotion.previous.effectiveTier} to ${demotion.current.effectiveTier}.`;
    const changed = demotion.changes.includes("snapshot_eligibility") ? ` Snapshot eligibility is now ${demotion.current.snapshotState}.` : "";

    return (
      `${tierChange} ` +
      `New placements qualify up to ${demotion.current.maxPlacementTier}.${changed} ` +
      `The existing lease remains open. Please visit ${link} to review the deployment.`
    );
  }

  private deliveryId(delivery: ProviderTierDemotionDelivery): string {
    const digest = createHash("sha256")
      .update(
        [
          "provider-tier-demotion",
          delivery.streamId,
          delivery.cursor,
          delivery.alertId,
          delivery.provider,
          delivery.lease.owner,
          delivery.lease.dseq,
          delivery.lease.gseq,
          delivery.lease.oseq,
          delivery.lease.bseq
        ].join("/")
      )
      .digest()
      .subarray(0, 16);
    digest[6] = (digest[6] & 0x0f) | 0x50;
    digest[8] = (digest[8] & 0x3f) | 0x80;
    const hex = digest.toString("hex");

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}
