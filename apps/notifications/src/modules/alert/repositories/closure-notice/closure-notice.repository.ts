import { InjectDrizzle } from "@knaadh/nestjs-drizzle-pg";
import { Injectable } from "@nestjs/common";
import { and, eq, isNotNull, isNull, lt, lte, max, min, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import sortBy from "lodash/sortBy";

import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import * as schema from "../../model-schemas";

const { ClosureNotice } = schema;

type Db = NodePgDatabase<typeof schema>;

export type ClosureNoticeInput = Omit<typeof ClosureNotice.$inferInsert, "id" | "sentAt">;

export type ClosureNoticeOutput = typeof ClosureNotice.$inferSelect;

export type ChannelClosureState = {
  oldestPendingAt: Date | null;
  lastSentAt: Date | null;
};

@Injectable()
export class ClosureNoticeRepository {
  constructor(@InjectDrizzle(DRIZZLE_PROVIDER_TOKEN) private readonly db: Db) {}

  /** Folds a closure into its alert's pending notice, so a deployment's lease-closed and deployment-closed events make one email whichever lands first. */
  async record(notice: ClosureNoticeInput, tx: Db = this.db): Promise<void> {
    await tx
      .insert(ClosureNotice)
      .values(notice)
      .onConflictDoUpdate({
        target: ClosureNotice.alertId,
        targetWhere: sql`sent_at IS NULL`,
        set: {
          deploymentClosed: sql`${ClosureNotice.deploymentClosed} OR excluded.deployment_closed`,
          providerLabel: sql`COALESCE(${ClosureNotice.providerLabel}, excluded.provider_label)`,
          leaseClosedReason: sql`COALESCE(${ClosureNotice.leaseClosedReason}, excluded.lease_closed_reason)`
        }
      });
  }

  async hasSentDeploymentClosure(alertId: string, tx: Db = this.db): Promise<boolean> {
    const [sent] = await tx
      .select({ id: ClosureNotice.id })
      .from(ClosureNotice)
      .where(and(eq(ClosureNotice.alertId, alertId), eq(ClosureNotice.deploymentClosed, true), isNotNull(ClosureNotice.sentAt)))
      .limit(1);

    return !!sent;
  }

  async findChannelState(notificationChannelId: string, tx: Db = this.db): Promise<ChannelClosureState> {
    const [pending] = await tx
      .select({ oldestPendingAt: min(ClosureNotice.createdAt) })
      .from(ClosureNotice)
      .where(and(eq(ClosureNotice.notificationChannelId, notificationChannelId), isNull(ClosureNotice.sentAt)));
    const [sent] = await tx
      .select({ lastSentAt: max(ClosureNotice.sentAt) })
      .from(ClosureNotice)
      .where(eq(ClosureNotice.notificationChannelId, notificationChannelId));

    return { oldestPendingAt: pending?.oldestPendingAt ?? null, lastSentAt: sent?.lastSentAt ?? null };
  }

  async transaction<T>(work: (tx: Db) => Promise<T>): Promise<T> {
    return this.db.transaction(tx => work(tx));
  }

  /** Serializes the flushes of a channel, so two of them can never both find it due and send it two emails. */
  async lockingChannel<T>(notificationChannelId: string, work: (tx: Db) => Promise<T>): Promise<T> {
    return this.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`closure_notices.${notificationChannelId}`}, 0))`);
      return work(tx);
    });
  }

  async claimPending(notificationChannelId: string, { createdUpTo, sentAt }: { createdUpTo: Date; sentAt: Date }, tx: Db = this.db): Promise<ClosureNoticeOutput[]> {
    const claimed = await tx
      .update(ClosureNotice)
      .set({ sentAt })
      .where(and(eq(ClosureNotice.notificationChannelId, notificationChannelId), isNull(ClosureNotice.sentAt), lte(ClosureNotice.createdAt, createdUpTo)))
      .returning();

    return sortBy(claimed, ["createdAt", "id"]);
  }

  async deleteSentBefore(cutoff: Date): Promise<void> {
    await this.db.delete(ClosureNotice).where(lt(ClosureNotice.sentAt, cutoff));
  }
}
