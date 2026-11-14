import { and, asc, count, eq, gt, isNull, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import type { FailedClassification } from "@src/feedback/model-schemas";

type Table = ApiPgTables["AssistantProblemReports"];
export type AssistantProblemReportInsert = Table["$inferInsert"];
export type AssistantProblemReportInput = Partial<AssistantProblemReportInsert>;
export type AssistantProblemReportOutput = Table["$inferSelect"];

@singleton()
export class AssistantProblemReportRepository extends BaseRepository<Table, AssistantProblemReportInput, AssistantProblemReportOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("AssistantProblemReports") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "AssistantProblemReport", "AssistantProblemReports");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new AssistantProblemReportRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async countSince(userId: string, since: Date): Promise<number> {
    const [result] = await this.cursor
      .select({ count: count() })
      .from(this.table)
      .where(this.whereAccessibleBy(and(eq(this.table.userId, userId), gt(this.table.createdAt, since))));

    return result.count;
  }

  /** Answers the themes the deleted reports belonged to, since their counts no longer hold. */
  async deleteAllOf(userId: string): Promise<string[]> {
    const deleted = await this.cursor
      .delete(this.table)
      .where(this.whereAccessibleBy(eq(this.table.userId, userId)))
      .returning({ themeId: this.table.themeId });

    return deleted.flatMap(({ themeId }) => (themeId ? [themeId] : []));
  }

  async findUnclassifiedIds(limit: number): Promise<string[]> {
    const rows = await this.cursor
      .select({ id: this.table.id })
      .from(this.table)
      .where(and(isNull(this.table.classifiedAt), isNull(this.table.classificationFailedAt)))
      .orderBy(asc(this.table.createdAt))
      .limit(limit);

    return rows.map(({ id }) => id);
  }

  /** Counts a classification attempt the model could not answer, and gives up on the item once it has used them all. */
  async recordFailedClassification(id: string, maxAttempts: number): Promise<FailedClassification | undefined> {
    const [row] = await this.cursor
      .update(this.table)
      .set({
        classificationAttempts: sql`${this.table.classificationAttempts} + 1`,
        classificationFailedAt: sql`CASE WHEN ${this.table.classificationAttempts} + 1 >= ${maxAttempts} THEN now() END`
      })
      .where(eq(this.table.id, id))
      .returning({ attempts: this.table.classificationAttempts, failedAt: this.table.classificationFailedAt });

    return row && { attempts: row.attempts, abandoned: row.failedAt !== null };
  }
}
