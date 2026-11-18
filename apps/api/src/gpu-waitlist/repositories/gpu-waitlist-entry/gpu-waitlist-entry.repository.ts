import { and, asc, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";

type Table = ApiPgTables["GpuWaitlistEntries"];
export type GpuWaitlistEntryInput = Partial<Table["$inferInsert"]>;
export type GpuWaitlistEntryOutput = Table["$inferSelect"];

@singleton()
export class GpuWaitlistEntryRepository extends OrgScopedRepository<Table, GpuWaitlistEntryInput, GpuWaitlistEntryOutput> {
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

  async findWaitingNewestFirst(): Promise<GpuWaitlistEntryOutput[]> {
    return await this.cursor
      .select()
      .from(this.table)
      .where(this.whereAccessibleBy(eq(this.table.status, "waiting")))
      .orderBy(desc(this.table.joinedAt));
  }

  async findWaitingInPoolOf(poolKey: string): Promise<GpuWaitlistEntryOutput | undefined> {
    const organizationId = this.scopedOrganizationId;
    const [entry] = await this.cursor
      .select()
      .from(this.table)
      .where(
        this.whereAccessibleBy(
          and(eq(this.table.poolKey, poolKey), eq(this.table.status, "waiting"), organizationId ? undefined : isNull(this.table.organizationId))
        )
      )
      .limit(1);

    return entry;
  }

  async findWaitingInPool(poolKey: string): Promise<GpuWaitlistEntryOutput[]> {
    return await this.cursor
      .select()
      .from(this.table)
      .where(and(eq(this.table.poolKey, poolKey), eq(this.table.status, "waiting")))
      .orderBy(asc(this.table.joinedAt), asc(this.table.id));
  }

  async findPlaceInLine(entry: Pick<GpuWaitlistEntryOutput, "poolKey" | "joinedAt">): Promise<number> {
    const [{ ahead }] = await this.cursor
      .select({ ahead: sql<number>`count(*)::int` })
      .from(this.table)
      .where(and(eq(this.table.poolKey, entry.poolKey), eq(this.table.status, "waiting"), lt(this.table.joinedAt, entry.joinedAt)));

    return ahead + 1;
  }

  async findJoinTimesSince(userId: string, since: Date): Promise<Date[]> {
    const rows = await this.cursor
      .select({ joinedAt: this.table.joinedAt })
      .from(this.table)
      .where(and(eq(this.table.userId, userId), gt(this.table.joinedAt, since)))
      .orderBy(asc(this.table.joinedAt));

    return rows.map(row => row.joinedAt);
  }

  async countWaitingFor(userId: string): Promise<number> {
    const [{ waiting }] = await this.cursor
      .select({ waiting: sql<number>`count(*)::int` })
      .from(this.table)
      .where(and(eq(this.table.userId, userId), eq(this.table.status, "waiting")));

    return waiting;
  }

  async findWaitingPoolKeys(): Promise<string[]> {
    const rows = await this.unscoped("gpu-waitlist-watcher")
      .cursor.selectDistinct({ poolKey: this.table.poolKey })
      .from(this.table)
      .where(eq(this.table.status, "waiting"));

    return rows.map(row => row.poolKey);
  }
}
