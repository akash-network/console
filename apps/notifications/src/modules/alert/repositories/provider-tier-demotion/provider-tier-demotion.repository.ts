import { InjectDrizzle } from "@knaadh/nestjs-drizzle-pg";
import { Injectable } from "@nestjs/common";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";

import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import * as schema from "@src/modules/alert/model-schemas";
import type { ProviderLeaseId } from "@src/modules/alert/types/provider-lease.type";

const FEED_CLAIM_TTL_MS = 15 * 60 * 1000;
const DELIVERY_CLAIM_TTL_MS = FEED_CLAIM_TTL_MS;

export interface ProviderTierDemotionFeedClaim {
  claimId: string;
  streamId: string | null;
  cursor: string;
}

export interface ProviderTierDemotionDelivery {
  streamId: string;
  cursor: string;
  alertId: string;
  provider: string;
  lease: ProviderLeaseId;
}

export type ProviderTierDemotionDeliveryClaim = { status: "claimed"; claimId: string } | { status: "sent" } | { status: "busy" };

@Injectable()
export class ProviderTierDemotionRepository {
  constructor(
    @InjectDrizzle(DRIZZLE_PROVIDER_TOKEN)
    private readonly db: NodePgDatabase<typeof schema>
  ) {}

  async claimFeed(): Promise<ProviderTierDemotionFeedClaim | undefined> {
    await this.db.insert(schema.ProviderTierDemotionState).values({ id: 1 }).onConflictDoNothing();

    const claimId = randomUUID();
    const now = new Date();
    const [state] = await this.db
      .update(schema.ProviderTierDemotionState)
      .set({
        claimId,
        claimExpiresAt: new Date(now.getTime() + FEED_CLAIM_TTL_MS),
        updatedAt: now
      })
      .where(
        and(
          eq(schema.ProviderTierDemotionState.id, 1),
          or(isNull(schema.ProviderTierDemotionState.claimExpiresAt), lt(schema.ProviderTierDemotionState.claimExpiresAt, now))
        )
      )
      .returning();

    return (
      state && {
        claimId,
        streamId: state.streamId,
        cursor: state.cursor.toString()
      }
    );
  }

  async setFeedPosition(claimId: string, streamId: string, cursor: string): Promise<void> {
    const rows = await this.db
      .update(schema.ProviderTierDemotionState)
      .set({ streamId, cursor: BigInt(cursor), updatedAt: new Date() })
      .where(and(eq(schema.ProviderTierDemotionState.id, 1), eq(schema.ProviderTierDemotionState.claimId, claimId)))
      .returning({ id: schema.ProviderTierDemotionState.id });

    if (rows.length !== 1) throw new Error("Provider tier-demotion feed claim was lost");
  }

  async advanceFeed(claimId: string, streamId: string, cursor: string): Promise<void> {
    const rows = await this.db
      .update(schema.ProviderTierDemotionState)
      .set({ cursor: BigInt(cursor), updatedAt: new Date() })
      .where(
        and(
          eq(schema.ProviderTierDemotionState.id, 1),
          eq(schema.ProviderTierDemotionState.claimId, claimId),
          eq(schema.ProviderTierDemotionState.streamId, streamId),
          lt(schema.ProviderTierDemotionState.cursor, BigInt(cursor))
        )
      )
      .returning({ id: schema.ProviderTierDemotionState.id });

    if (rows.length !== 1) throw new Error("Provider tier-demotion feed claim was lost");
  }

  async releaseFeed(claimId: string): Promise<void> {
    await this.db
      .update(schema.ProviderTierDemotionState)
      .set({ claimId: null, claimExpiresAt: null, updatedAt: new Date() })
      .where(and(eq(schema.ProviderTierDemotionState.id, 1), eq(schema.ProviderTierDemotionState.claimId, claimId)));
  }

  async claimDelivery(delivery: ProviderTierDemotionDelivery): Promise<ProviderTierDemotionDeliveryClaim> {
    const claimId = randomUUID();
    const values = this.deliveryValues(delivery, claimId);
    const inserted = await this.db
      .insert(schema.ProviderTierDemotionNotification)
      .values(values)
      .onConflictDoNothing()
      .returning({ claimId: schema.ProviderTierDemotionNotification.claimId });

    if (inserted[0]) return { status: "claimed", claimId: inserted[0].claimId };

    const staleBefore = new Date(Date.now() - DELIVERY_CLAIM_TTL_MS);
    const [reclaimed] = await this.db
      .update(schema.ProviderTierDemotionNotification)
      .set({ claimId, claimedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          this.deliveryWhere(delivery),
          eq(schema.ProviderTierDemotionNotification.status, "PENDING"),
          lt(schema.ProviderTierDemotionNotification.claimedAt, staleBefore)
        )
      )
      .returning({ claimId: schema.ProviderTierDemotionNotification.claimId });

    if (reclaimed) return { status: "claimed", claimId: reclaimed.claimId };

    const existing = await this.db.query.ProviderTierDemotionNotification.findFirst({
      columns: { status: true },
      where: this.deliveryWhere(delivery)
    });
    if (!existing) throw new Error("Provider tier-demotion delivery disappeared while being claimed");

    return existing.status === "SENT" ? { status: "sent" } : { status: "busy" };
  }

  async completeDelivery(delivery: ProviderTierDemotionDelivery, claimId: string): Promise<void> {
    const rows = await this.db
      .update(schema.ProviderTierDemotionNotification)
      .set({ status: "SENT", sentAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          this.deliveryWhere(delivery),
          eq(schema.ProviderTierDemotionNotification.status, "PENDING"),
          eq(schema.ProviderTierDemotionNotification.claimId, claimId)
        )
      )
      .returning({ id: schema.ProviderTierDemotionNotification.id });

    if (rows.length !== 1) throw new Error("Provider tier-demotion delivery claim was lost");
  }

  async releaseDelivery(delivery: ProviderTierDemotionDelivery, claimId: string): Promise<void> {
    await this.db
      .delete(schema.ProviderTierDemotionNotification)
      .where(
        and(
          this.deliveryWhere(delivery),
          eq(schema.ProviderTierDemotionNotification.status, "PENDING"),
          eq(schema.ProviderTierDemotionNotification.claimId, claimId)
        )
      );
  }

  private deliveryValues(delivery: ProviderTierDemotionDelivery, claimId: string): typeof schema.ProviderTierDemotionNotification.$inferInsert {
    return {
      streamId: delivery.streamId,
      cursor: BigInt(delivery.cursor),
      alertId: delivery.alertId,
      provider: delivery.provider,
      owner: delivery.lease.owner,
      dseq: delivery.lease.dseq,
      gseq: delivery.lease.gseq,
      oseq: delivery.lease.oseq,
      bseq: delivery.lease.bseq,
      claimId
    };
  }

  private deliveryWhere(delivery: ProviderTierDemotionDelivery) {
    return and(
      eq(schema.ProviderTierDemotionNotification.streamId, delivery.streamId),
      eq(schema.ProviderTierDemotionNotification.cursor, BigInt(delivery.cursor)),
      eq(schema.ProviderTierDemotionNotification.alertId, delivery.alertId),
      eq(schema.ProviderTierDemotionNotification.provider, delivery.provider),
      eq(schema.ProviderTierDemotionNotification.owner, delivery.lease.owner),
      eq(schema.ProviderTierDemotionNotification.dseq, delivery.lease.dseq),
      eq(schema.ProviderTierDemotionNotification.gseq, delivery.lease.gseq),
      eq(schema.ProviderTierDemotionNotification.oseq, delivery.lease.oseq),
      eq(schema.ProviderTierDemotionNotification.bseq, delivery.lease.bseq)
    );
  }
}
