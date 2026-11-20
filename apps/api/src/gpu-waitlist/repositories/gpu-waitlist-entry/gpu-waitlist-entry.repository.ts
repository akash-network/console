import { and, asc, desc, eq, gt, lt, or, sql } from "drizzle-orm";
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
}
