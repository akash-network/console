import { sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable, resolveTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["FeedbackThemes"];
export type FeedbackThemeInput = Partial<Table["$inferInsert"]>;
export type FeedbackThemeOutput = Table["$inferSelect"];

@singleton()
export class FeedbackThemeRepository extends BaseRepository<Table, FeedbackThemeInput, FeedbackThemeOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("FeedbackThemes") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "FeedbackTheme", "FeedbackThemes");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new FeedbackThemeRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  /** Recounts the themes from the submissions and conversations still attached to them, so deleted items stop counting. */
  async refreshCounts(themeIds: string[]): Promise<void> {
    const uniqueThemeIds = [...new Set(themeIds)];
    if (uniqueThemeIds.length === 0) return;

    const submissions = resolveTable("FeedbackSubmissions");
    const conversations = resolveTable("AssistantConversations");

    await this.cursor.execute(sql`
      UPDATE ${this.table}
      SET
        item_count = items.item_count,
        distinct_user_count = items.distinct_user_count,
        first_seen_at = items.first_seen_at,
        last_seen_at = items.last_seen_at,
        updated_at = now()
      FROM (
        SELECT
          theme.id,
          count(item.user_id)::int AS item_count,
          count(DISTINCT item.user_id)::int AS distinct_user_count,
          min(item.seen_at) AS first_seen_at,
          max(item.seen_at) AS last_seen_at
        FROM ${this.table} AS theme
        LEFT JOIN (
          SELECT ${submissions.themeId} AS theme_id, ${submissions.userId} AS user_id, ${submissions.createdAt} AS seen_at FROM ${submissions}
          UNION ALL
          SELECT ${conversations.themeId}, ${conversations.userId}, ${conversations.startedAt} FROM ${conversations}
        ) AS item ON item.theme_id = theme.id
        WHERE theme.id IN ${uniqueThemeIds}
        GROUP BY theme.id
      ) AS items
      WHERE ${this.table.id} = items.id
    `);
  }
}
