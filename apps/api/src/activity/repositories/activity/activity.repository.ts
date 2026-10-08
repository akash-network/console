import { and, count, desc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import type { ActivityPosition } from "@src/activity/lib/activity-cursor/activity-cursor";
import type { ActivityStatus, ActivityType } from "@src/activity/model-schemas";
import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["Activities"];
export type ActivityInput = Partial<Table["$inferInsert"]>;
export type ActivityDbOutput = Table["$inferSelect"];

export type ActivityOutput = Omit<ActivityDbOutput, "seenAt" | "createdAt" | "updatedAt"> & {
  seenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ActivitySelection = { ids: string[] } | { upTo: string };

@singleton()
export class ActivityRepository extends BaseRepository<Table, ActivityInput, ActivityOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("Activities") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "Activity", "Activities");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new ActivityRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  /** Newest first, ordered by id within a shared timestamp so that a page boundary falling inside one millisecond neither skips nor repeats a row. */
  async findPage({
    limit,
    after,
    status,
    type
  }: {
    limit: number;
    after?: ActivityPosition;
    status?: ActivityStatus;
    type?: ActivityType;
  }): Promise<ActivityOutput[]> {
    const rows = await this.cursor
      .select()
      .from(this.table)
      .where(
        this.whereAccessibleBy(
          and(status ? eq(this.table.status, status) : undefined, type ? eq(this.table.type, type) : undefined, after ? this.#isOlderThan(after) : undefined)
        )
      )
      .orderBy(desc(this.table.createdAt), desc(this.table.id))
      .limit(limit);

    return this.toOutputList(rows);
  }

  async countUnseen(): Promise<number> {
    const [result] = await this.cursor
      .select({ count: count() })
      .from(this.table)
      .where(this.whereAccessibleBy(isNull(this.table.seenAt)));

    return result.count;
  }

  async markSeen(selection: ActivitySelection): Promise<void> {
    const selected = "ids" in selection ? inArray(this.table.id, selection.ids) : lte(this.table.createdAt, new Date(selection.upTo));

    await this.cursor
      .update(this.table)
      .set({ seenAt: sql`now()`, updatedAt: sql`now()` })
      .where(this.whereAccessibleBy(and(isNull(this.table.seenAt), selected)));
  }

  async updateByIdIfStatusIn(id: string, statuses: ActivityStatus[], payload: ActivityInput): Promise<void> {
    await this.cursor
      .update(this.table)
      .set({ ...payload, updatedAt: sql`now()` })
      .where(this.whereAccessibleBy(and(eq(this.table.id, id), inArray(this.table.status, statuses))));
  }

  #isOlderThan({ createdAt, id }: ActivityPosition) {
    const at = new Date(createdAt);
    return or(lt(this.table.createdAt, at), and(eq(this.table.createdAt, at), lt(this.table.id, id)));
  }

  protected toOutput(payload: ActivityDbOutput): ActivityOutput {
    return {
      ...payload,
      seenAt: payload.seenAt?.toISOString() ?? null,
      createdAt: payload.createdAt.toISOString(),
      updatedAt: payload.updatedAt.toISOString()
    };
  }
}
