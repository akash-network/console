import { and, asc, desc, eq, gt, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";

type Table = ApiPgTables["GpuWaitlistEntries"];
export type GpuWaitlistEntryInput = Partial<Table["$inferInsert"]>;
export type GpuWaitlistEntryRow = Table["$inferSelect"];

@singleton()
export class GpuWaitlistEntryRepository extends OrgScopedRepository<Table, GpuWaitlistEntryInput, GpuWaitlistEntryRow> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("GpuWaitlistEntries") protected readonly table: Table,
    protected readonly txManager: TxService,
    protected readonly executionContextService: ExecutionContextService
  ) {
    super(pg, table, txManager, executionContextService, "GpuWaitlistEntry", "GpuWaitlistEntries");
  }

  protected newInstance() {
    return new GpuWaitlistEntryRepository(this.pg, this.table, this.txManager, this.executionContextService) as this;
  }

  async findWaitingNewestFirst(): Promise<GpuWaitlistEntryRow[]> {
    return await this.cursor
      .select()
      .from(this.table)
      .where(this.whereAccessibleBy(eq(this.table.status, "waiting")))
      .orderBy(desc(this.table.joinedAt));
  }

  async findWaitingInPoolOf(poolKey: string): Promise<GpuWaitlistEntryRow | undefined> {
    const [entry] = await this.cursor
      .select()
      .from(this.table)
      .where(this.whereAccessibleBy(and(eq(this.table.poolKey, poolKey), eq(this.table.status, "waiting"))))
      .limit(1);

    return entry;
  }

  async findByIdAcrossOrganizations(id: string): Promise<GpuWaitlistEntryRow | undefined> {
    return await this.unscoped("gpu-waitlist-notice").findById(id);
  }

  async findWaitingInPoolAcrossOrganizations(poolKey: string): Promise<GpuWaitlistEntryRow[]> {
    return await this.cursor
      .select()
      .from(this.table)
      .where(and(eq(this.table.poolKey, poolKey), eq(this.table.status, "waiting")))
      .orderBy(asc(this.table.joinedAt), asc(this.table.id));
  }

  /** Reads the entry's join time in SQL, because a JavaScript Date drops the microseconds the column orders by. */
  async findPlaceInLineAcrossOrganizations(entry: Pick<GpuWaitlistEntryRow, "id" | "poolKey">): Promise<number> {
    const target = alias(this.table, "target");
    const entryJoinedAt = sql`(${this.cursor.select({ joinedAt: target.joinedAt }).from(target).where(eq(target.id, entry.id))})`;
    const [{ ahead }] = await this.cursor
      .select({ ahead: sql<number>`count(*)::int` })
      .from(this.table)
      .where(
        and(
          eq(this.table.poolKey, entry.poolKey),
          eq(this.table.status, "waiting"),
          or(lt(this.table.joinedAt, entryJoinedAt), and(eq(this.table.joinedAt, entryJoinedAt), lt(this.table.id, entry.id)))
        )
      );

    return ahead + 1;
  }

  async findJoinTimesAcrossOrganizationsSince(userId: string, since: Date): Promise<Date[]> {
    const rows = await this.cursor
      .select({ joinedAt: this.table.joinedAt })
      .from(this.table)
      .where(and(eq(this.table.userId, userId), gt(this.table.joinedAt, since)))
      .orderBy(asc(this.table.joinedAt));

    return rows.map(row => row.joinedAt);
  }

  async countWaitingAcrossOrganizations(userId: string): Promise<number> {
    const [{ waiting }] = await this.cursor
      .select({ waiting: sql<number>`count(*)::int` })
      .from(this.table)
      .where(and(eq(this.table.userId, userId), eq(this.table.status, "waiting")));

    return waiting;
  }

  async findWaitingPoolKeysAcrossOrganizations(): Promise<string[]> {
    const unscoped = this.unscoped("gpu-waitlist-watcher");
    const rows = await unscoped.cursor
      .selectDistinct({ poolKey: this.table.poolKey })
      .from(this.table)
      .where(unscoped.whereAccessibleBy(eq(this.table.status, "waiting")));

    return rows.map(row => row.poolKey);
  }

  async findWaitingById(id: string): Promise<GpuWaitlistEntryRow | undefined> {
    const [entry] = await this.cursor
      .select()
      .from(this.table)
      .where(this.whereAccessibleBy(and(eq(this.table.id, id), eq(this.table.status, "waiting"))))
      .limit(1);

    return entry;
  }

  async clearPendingStillWantedQuestion(id: string): Promise<GpuWaitlistEntryRow | undefined> {
    const where = this.whereAccessibleBy(and(eq(this.table.id, id), eq(this.table.status, "waiting"), isNotNull(this.table.stillWantedAskedAt)));
    const [cleared] = await this.updateWhere(where, { stillWantedAskedAt: null }, { returning: true });

    return cleared && this.toOutput(cleared);
  }

  async claimStillWantedQuestion(id: string): Promise<GpuWaitlistEntryRow | undefined> {
    const [claimed] = await this.unscoped("gpu-waitlist-watcher")
      .cursor.update(this.table)
      .set({ stillWantedAskedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(this.table.id, id), eq(this.table.status, "waiting"), isNull(this.table.stillWantedAskedAt)))
      .returning();

    return claimed;
  }

  async expireUnansweredQuestion(id: string, graceDays: number): Promise<GpuWaitlistEntryRow | undefined> {
    const [expired] = await this.unscoped("gpu-waitlist-watcher")
      .cursor.update(this.table)
      .set({ status: "expired", endedAt: sql`now()`, updatedAt: sql`now()` })
      .where(
        and(
          eq(this.table.id, id),
          eq(this.table.status, "waiting"),
          isNotNull(this.table.stillWantedAskedAt),
          sql`${this.table.stillWantedAskedAt} <= now() - make_interval(hours => ${graceDays * 24})`
        )
      )
      .returning();

    return expired;
  }

  async markWaitingFulfilledAcrossOrganizations({
    userId,
    organizationId,
    joinedBefore,
    gpus
  }: {
    userId: string | null;
    organizationId: string | null;
    joinedBefore: Date;
    gpus: { vendor: string; model: string; count: number }[];
  }): Promise<string[]> {
    const owner = organizationId ? eq(this.table.organizationId, organizationId) : userId ? eq(this.table.userId, userId) : undefined;

    if (!owner || gpus.length === 0) return [];

    const coveredByLease = or(
      ...gpus.map(({ vendor, model, count }) =>
        and(
          sql`lower(${this.table.vendor}) = ${vendor.toLowerCase()}`,
          sql`lower(${this.table.model}) = ${model.toLowerCase()}`,
          lte(this.table.gpuCount, count)
        )
      )
    );
    const fulfilled = await this.unscoped("gpu-waitlist-watcher")
      .cursor.update(this.table)
      .set({ status: "fulfilled", endedAt: new Date(), updatedAt: sql`now()` })
      .where(and(eq(this.table.status, "waiting"), owner, lt(this.table.joinedAt, joinedBefore), coveredByLease))
      .returning({ id: this.table.id });

    return fulfilled.map(({ id }) => id);
  }
}
