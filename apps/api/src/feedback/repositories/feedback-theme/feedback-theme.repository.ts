import { and, asc, desc, eq, gt, ne, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable, resolveTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import { type FeedbackThemeScoreSignal, FIRST_WEEK_DAYS } from "@src/feedback/lib/feedback-theme-score/feedback-theme-score";
import type { FeedbackClassificationType } from "@src/feedback/model-schemas";

/** Bounds a merge chain, so a cycle written by hand cannot loop forever. */
const MAX_MERGE_HOPS = 10;

export type ThemedScoreSignal = FeedbackThemeScoreSignal & { themeId: string };

interface ScoreSignalRow extends Record<string, unknown> {
  theme_id: string;
  user_id: string;
  seen_at: Date | string;
  rating: number | null;
  sentiment_score: number | null;
  ended_stuck: boolean | null;
  deployment_failed: boolean;
  is_paying_user: boolean;
  is_first_week_user: boolean;
}

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

  /** Themes still taking items, most recently active first, which are the ones a new item most likely belongs to. */
  async findMatchCandidates(type: FeedbackClassificationType, limit: number): Promise<FeedbackThemeOutput[]> {
    return await this.cursor
      .select()
      .from(this.table)
      .where(and(eq(this.table.type, type), ne(this.table.status, "merged")))
      .orderBy(sql`${this.table.lastSeenAt} DESC NULLS LAST`, desc(this.table.createdAt))
      .limit(limit);
  }

  /** Answers the theme a merged one was folded into, or null when the chain ends nowhere. */
  async resolveActiveId(themeId: string): Promise<string | null> {
    let current = await this.findById(themeId);

    for (let hop = 0; current?.status === "merged" && hop < MAX_MERGE_HOPS; hop++) {
      current = current.mergedIntoId ? await this.findById(current.mergedIntoId) : undefined;
    }

    return current && current.status !== "merged" ? current.id : null;
  }

  async findRankableIds(afterId: string | null, limit: number): Promise<string[]> {
    const rows = await this.cursor
      .select({ id: this.table.id })
      .from(this.table)
      .where(and(ne(this.table.status, "merged"), afterId ? gt(this.table.id, afterId) : undefined))
      .orderBy(asc(this.table.id))
      .limit(limit);

    return rows.map(({ id }) => id);
  }

  async updateScore(themeId: string, score: number): Promise<void> {
    await this.cursor.update(this.table).set({ score }).where(eq(this.table.id, themeId));
  }

  /** Paying means the personal wallet or the organization wallet the item was filed under has left the trial. */
  async findScoreSignals(themeIds: string[]): Promise<ThemedScoreSignal[]> {
    if (themeIds.length === 0) return [];

    const submissions = resolveTable("FeedbackSubmissions");
    const conversations = resolveTable("AssistantConversations");
    const users = resolveTable("Users");
    const wallets = resolveTable("UserWallets");

    const rows = await this.cursor.execute<ScoreSignalRow>(sql`
      SELECT
        item.theme_id,
        item.user_id,
        item.seen_at,
        item.rating,
        item.sentiment_score,
        item.ended_stuck,
        item.deployment_failed,
        coalesce(personal_wallet.trial = false OR organization_wallet.trial = false, false) AS is_paying_user,
        coalesce(item.seen_at < ${users.createdAt} + make_interval(days => ${FIRST_WEEK_DAYS}), false) AS is_first_week_user
      FROM (
        SELECT
          ${submissions.themeId} AS theme_id,
          ${submissions.userId} AS user_id,
          ${submissions.organizationId} AS organization_id,
          ${submissions.createdAt} AS seen_at,
          ${submissions.rating}::int AS rating,
          ${submissions.sentimentScore} AS sentiment_score,
          ${submissions.endedStuck} AS ended_stuck,
          coalesce(${submissions.outcome} = 'failed', false) AS deployment_failed
        FROM ${submissions}
        WHERE ${submissions.themeId} IN ${themeIds}
        UNION ALL
        SELECT
          ${conversations.themeId},
          ${conversations.userId},
          ${conversations.organizationId},
          ${conversations.startedAt},
          NULL::int,
          ${conversations.sentimentScore},
          ${conversations.endedStuck},
          false
        FROM ${conversations}
        WHERE ${conversations.themeId} IN ${themeIds}
      ) AS item
      LEFT JOIN ${users} ON ${users.id} = item.user_id
      LEFT JOIN ${wallets} AS personal_wallet ON personal_wallet.user_id = item.user_id
      LEFT JOIN ${wallets} AS organization_wallet ON organization_wallet.organization_id = item.organization_id
    `);

    return rows.map(row => ({
      themeId: row.theme_id,
      userId: row.user_id,
      seenAt: new Date(row.seen_at),
      rating: row.rating,
      sentimentScore: row.sentiment_score,
      endedStuck: row.ended_stuck,
      deploymentFailed: row.deployment_failed,
      isPayingUser: row.is_paying_user,
      isFirstWeekUser: row.is_first_week_user
    }));
  }
}
