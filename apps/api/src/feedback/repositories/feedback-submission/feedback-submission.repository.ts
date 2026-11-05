import { and, asc, count, eq, gt, isNull, max } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["FeedbackSubmissions"];
export type FeedbackSubmissionInsert = Table["$inferInsert"];
export type FeedbackSubmissionInput = Partial<FeedbackSubmissionInsert>;
export type FeedbackSubmissionOutput = Table["$inferSelect"];

@singleton()
export class FeedbackSubmissionRepository extends BaseRepository<Table, FeedbackSubmissionInput, FeedbackSubmissionOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("FeedbackSubmissions") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "FeedbackSubmission", "FeedbackSubmissions");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new FeedbackSubmissionRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  /** Answers nothing when the user already answered the outcome prompt of this deployment. */
  async createUnlessAnswered(input: FeedbackSubmissionInsert): Promise<FeedbackSubmissionOutput | undefined> {
    this.ability?.throwUnlessCanExecute(input);
    const [item] = await this.cursor.insert(this.table).values(input).onConflictDoNothing().returning();

    return item;
  }

  async countSince(userId: string, since: Date): Promise<number> {
    const [result] = await this.cursor
      .select({ count: count() })
      .from(this.table)
      .where(this.whereAccessibleBy(and(eq(this.table.userId, userId), gt(this.table.createdAt, since))));

    return result.count;
  }

  async findLatestOutcomeAnswerAt(userId: string): Promise<Date | null> {
    const [result] = await this.cursor
      .select({ createdAt: max(this.table.createdAt) })
      .from(this.table)
      .where(this.whereAccessibleBy(and(eq(this.table.userId, userId), eq(this.table.kind, "deployment_outcome"))));

    return result.createdAt;
  }

  async deleteAllOf(userId: string): Promise<string[]> {
    const deleted = await this.cursor.delete(this.table).where(eq(this.table.userId, userId)).returning({ themeId: this.table.themeId });

    return deleted.flatMap(({ themeId }) => (themeId ? [themeId] : []));
  }

  async findUnclassifiedIds(limit: number): Promise<string[]> {
    const rows = await this.cursor
      .select({ id: this.table.id })
      .from(this.table)
      .where(and(isNull(this.table.classifiedAt), eq(this.table.dismissed, false)))
      .orderBy(asc(this.table.createdAt))
      .limit(limit);

    return rows.map(({ id }) => id);
  }
}
