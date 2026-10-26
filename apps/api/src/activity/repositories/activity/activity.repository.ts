import { and, asc, count, desc, eq, gt, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import type { ActivityPosition } from "@src/activity/lib/activity-cursor/activity-cursor";
import { ACTIVITIES_DEDUPE_KEY_INDEX, type ActivityStatus, type ActivityType } from "@src/activity/model-schemas";
import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository, getPostgresError, isUniqueViolation } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import type { OrganizationContext } from "@src/organization/types/organization-context";

type Table = ApiPgTables["Activities"];
export type ActivityInput = Partial<Table["$inferInsert"]>;
export type ActivityDbOutput = Table["$inferSelect"];

export type ActivityOutput = Omit<ActivityDbOutput, "seenAt" | "createdAt" | "updatedAt"> & {
  seenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ActivitySelection = { ids: string[] } | { upTo: string };

/** One organization's feed, which leaves out what the user did in their other organizations. */
export type ActivityFeed = Pick<OrganizationContext, "organizationId" | "organizationType">;

export type PendingActivitySummary = { type: ActivityType; count: number; oldestCreatedAt: Date };

const FOREIGN_KEY_VIOLATION_CODE = "23503";

export function isDedupeKeyTaken(error: unknown): boolean {
  return isUniqueViolation(error) && getPostgresError(error)?.constraint_name === ACTIVITIES_DEDUPE_KEY_INDEX;
}

/** The user is the only row an activity references, so a foreign key violation on a write means the user does not exist. */
export function isUnknownUser(error: unknown): boolean {
  return getPostgresError(error)?.code === FOREIGN_KEY_VIOLATION_CODE;
}

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

  /** Writes nothing when another of the user's rows already holds the dedupe key, which is how two reports of one outcome stay one row. */
  async createUnlessDuplicate(input: Table["$inferInsert"]): Promise<ActivityOutput | undefined> {
    this.ability?.throwUnlessCanExecute(input);
    const [created] = await this.cursor
      .insert(this.table)
      .values(input)
      .onConflictDoNothing({ target: [this.table.userId, this.table.dedupeKey], where: isNotNull(this.table.dedupeKey) })
      .returning();

    return created && this.toOutput(created);
  }

  /** Newest first, ordered by id within a shared timestamp so that a page boundary falling inside one millisecond neither skips nor repeats a row. */
  async findPage({
    limit,
    after,
    status,
    type,
    feed
  }: {
    limit: number;
    after?: ActivityPosition;
    status?: ActivityStatus;
    type?: ActivityType;
    feed?: ActivityFeed;
  }): Promise<ActivityOutput[]> {
    const rows = await this.cursor
      .select()
      .from(this.table)
      .where(
        this.whereAccessibleBy(
          and(
            status ? eq(this.table.status, status) : undefined,
            type ? eq(this.table.type, type) : undefined,
            after ? this.#isOlderThan(after) : undefined,
            this.#isListedIn(feed)
          )
        )
      )
      .orderBy(desc(this.table.createdAt), desc(this.table.id))
      .limit(limit);

    return this.toOutputList(rows);
  }

  async countUnseen(feed?: ActivityFeed): Promise<number> {
    const [result] = await this.cursor
      .select({ count: count() })
      .from(this.table)
      .where(this.whereAccessibleBy(and(isNull(this.table.seenAt), this.#isListedIn(feed))));

    return result.count;
  }

  async markSeen(selection: ActivitySelection, feed?: ActivityFeed): Promise<void> {
    const selected = "ids" in selection ? inArray(this.table.id, selection.ids) : lte(this.table.createdAt, new Date(selection.upTo));

    await this.cursor
      .update(this.table)
      .set({ seenAt: sql`now()`, updatedAt: sql`now()` })
      .where(this.whereAccessibleBy(and(isNull(this.table.seenAt), selected, this.#isListedIn(feed))));
  }

  async updateByIdIfStatusIn(id: string, statuses: ActivityStatus[], payload: ActivityInput): Promise<ActivityOutput | undefined> {
    const [updated] = await this.cursor
      .update(this.table)
      .set({ ...payload, updatedAt: sql`now()` })
      .where(this.whereAccessibleBy(and(eq(this.table.id, id), inArray(this.table.status, statuses))))
      .returning();

    return updated && this.toOutput(updated);
  }

  async summarizePendingByType(): Promise<PendingActivitySummary[]> {
    return await this.cursor
      .select({ type: this.table.type, count: count(), oldestCreatedAt: sql<Date>`min(${this.table.createdAt})`.mapWith(this.table.createdAt) })
      .from(this.table)
      .where(this.whereAccessibleBy(eq(this.table.status, "pending")))
      .groupBy(this.table.type);
  }

  /** Deletes at most `limit` rows a call, oldest first, so a backlog clears in short statements that never hold the table for long. */
  async deleteSettledCreatedBefore(createdBefore: Date, limit: number): Promise<number> {
    const expired = this.cursor
      .select({ id: this.table.id })
      .from(this.table)
      .where(this.whereAccessibleBy(and(lt(this.table.createdAt, createdBefore), ne(this.table.status, "pending"))))
      .orderBy(asc(this.table.createdAt))
      .limit(limit);
    const deleted = await this.cursor.delete(this.table).where(inArray(this.table.id, expired)).returning({ id: this.table.id });

    return deleted.length;
  }

  async hasSucceededSince({ userId, type, dseq, since }: { userId: string; type: ActivityType; dseq: string; since: string }): Promise<boolean> {
    const [succeeded] = await this.cursor
      .select({ id: this.table.id })
      .from(this.table)
      .where(
        this.whereAccessibleBy(
          and(
            eq(this.table.userId, userId),
            eq(this.table.type, type),
            eq(this.table.status, "succeeded"),
            sql`${this.table.meta}->>'dseq' = ${dseq}`,
            gt(this.table.createdAt, new Date(since))
          )
        )
      )
      .limit(1);

    return !!succeeded;
  }

  #isListedIn(feed: ActivityFeed | undefined) {
    if (!feed) return undefined;

    const isFiledIn = eq(this.table.organizationId, feed.organizationId);

    return feed.organizationType === "personal" ? or(isFiledIn, isNull(this.table.organizationId)) : isFiledIn;
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
