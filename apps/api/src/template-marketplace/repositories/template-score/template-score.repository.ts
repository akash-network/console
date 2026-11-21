import { and, eq, inArray, lt, type SQL, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";
import type { ScoredTemplate, ScoredTemplateKey, StillRunningUserDays } from "@src/template-marketplace/lib/template-scores/template-scores";
import type { TemplateSource, TemplateUsageAction } from "@src/template-marketplace/model-schemas/template-usage-event/template-usage-event.schema";

type Table = ApiPgTables["TemplateScores"];

export type TemplateScoreOutput = Table["$inferSelect"];

export type ServedTemplateScore = Pick<TemplateScoreOutput, "popularScore" | "trendingScore" | "isTrending">;

export type CountedWindow = { now: Date; maxTemplates: number };

export type ReplacedScores = { written: number; deleted: number };

const COUNTED_NETWORK = "mainnet";

const AWESOME_AKASH_ID_PATTERN = "^[A-Za-z0-9][A-Za-z0-9._-]*$";

export const WEEKLY_DEPLOYER_DAYS = 7;

const WRITTEN_SCORES_PER_STATEMENT = 500;

/** Written by the recompute job and read across organizations, so it carries no ability rules. */
@singleton()
export class TemplateScoreRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("TemplateScores") private readonly table: Table,
    @InjectPgTable("TemplateUsageEvents") private readonly usageEvents: ApiPgTables["TemplateUsageEvents"],
    @InjectPgTable("Templates") private readonly templates: ApiPgTables["Templates"],
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  /** Counts a user once per template and UTC day, as a trial only when every deployment that day was a trial one, for the templates with the most such days. */
  async findStillRunningUserDays({
    now,
    lookbackDays,
    maxTemplates
  }: CountedWindow & { lookbackDays: number }): Promise<(ScoredTemplateKey & StillRunningUserDays)[]> {
    const rows = await this.#cursor.execute<ScoredTemplateKey & StillRunningUserDays>(sql`
      with counted as (${this.#countedEvents("still_running_24h", now, lookbackDays)}),
      user_days as (
        select source, template_ref, user_id, bool_and(is_trial) as is_trial, min(created_at) as first_at
        from counted
        group by source, template_ref, user_id, (created_at at time zone 'UTC')::date
      ),
      ranked as (
        select source, template_ref
        from user_days
        group by source, template_ref
        order by count(*) desc, source, template_ref
        limit ${maxTemplates}
      )
      select
        user_days.source,
        user_days.template_ref as "templateRef",
        floor(extract(epoch from (${now.toISOString()}::timestamptz - user_days.first_at)) / 86400)::int as "ageDays",
        (count(*) filter (where not user_days.is_trial))::int as paid,
        (count(*) filter (where user_days.is_trial))::int as trial
      from user_days
      inner join ranked using (source, template_ref)
      group by 1, 2, 3
      order by 1, 2, 3
    `);

    return [...rows];
  }

  /** Counts the same people the held-version rule does: mainnet deployers of the last week from outside the publishing organization, for the most deployed templates and for every one named in `including`. */
  async countWeeklyDeployers({
    now,
    maxTemplates,
    including = []
  }: CountedWindow & { including?: ScoredTemplateKey[] }): Promise<(ScoredTemplateKey & { weeklyDeployers: number })[]> {
    const included = JSON.stringify(including.map(({ source, templateRef }) => ({ source, templateRef })));
    const rows = await this.#cursor.execute<ScoredTemplateKey & { weeklyDeployers: number }>(sql`
      with counted as (${this.#countedEvents("deploy", now, WEEKLY_DEPLOYER_DAYS)}),
      counts as (
        select source, template_ref, count(distinct user_id)::int as weekly_deployers
        from counted
        group by source, template_ref
      ),
      ranked as (
        select source, template_ref, weekly_deployers, row_number() over (order by weekly_deployers desc, source, template_ref) as rank
        from counts
      )
      select source, template_ref as "templateRef", weekly_deployers as "weeklyDeployers"
      from ranked
      where rank <= ${maxTemplates}
        or (source::text, template_ref) in (
          select included.source, included."templateRef" from jsonb_to_recordset(${included}::jsonb) as included(source text, "templateRef" text)
        )
      order by 3 desc, 1, 2
    `);

    return [...rows];
  }

  /** Leaves a row a later run already wrote, and drops the rows this run did not score, so a retried run can neither undo newer scores nor keep stale ones. */
  async replaceAll(scores: ScoredTemplate[], computedAt: Date): Promise<ReplacedScores> {
    for (let start = 0; start < scores.length; start += WRITTEN_SCORES_PER_STATEMENT) {
      await this.#cursor
        .insert(this.table)
        .values(scores.slice(start, start + WRITTEN_SCORES_PER_STATEMENT).map(score => ({ ...score, computedAt })))
        .onConflictDoUpdate({
          target: [this.table.source, this.table.templateRef],
          set: {
            popularScore: sql`excluded.popular_score`,
            trendingScore: sql`excluded.trending_score`,
            weeklyDeployers: sql`excluded.weekly_deployers`,
            isTrending: sql`excluded.is_trending`,
            breakdown: sql`excluded.breakdown`,
            computedAt: sql`excluded.computed_at`
          },
          setWhere: sql`${this.table.computedAt} <= excluded.computed_at`
        });
    }

    const deleted = await this.#cursor.delete(this.table).where(lt(this.table.computedAt, computedAt)).returning({ templateRef: this.table.templateRef });

    return { written: scores.length, deleted: deleted.length };
  }

  async findByRefs(source: TemplateSource, templateRefs: string[]): Promise<Map<string, ServedTemplateScore>> {
    if (!templateRefs.length) return new Map();

    const rows = await this.#cursor
      .select({
        templateRef: this.table.templateRef,
        popularScore: this.table.popularScore,
        trendingScore: this.table.trendingScore,
        isTrending: this.table.isTrending
      })
      .from(this.table)
      .where(and(eq(this.table.source, source), inArray(this.table.templateRef, templateRefs)));

    return new Map(rows.map(({ templateRef, ...score }) => [templateRef, score]));
  }

  /** A Console template's own organization never counts, and an awesome-akash id is whatever a deployment named, so only ids shaped like the gallery's do. */
  #countedEvents(action: TemplateUsageAction, now: Date, lookbackDays: number): SQL {
    const events = this.usageEvents;

    return sql`
      select ${events.source} as source, ${events.templateRef} as template_ref, ${events.userId} as user_id, ${events.isTrial} as is_trial, ${events.createdAt} as created_at
      from ${events}
      left join ${this.templates} on ${events.source} = 'console' and ${events.templateRef} = ${this.templates.id}::text
      where ${events.network} = ${COUNTED_NETWORK}
        and ${events.action} = ${action}
        and ${events.userId} is not null
        and ${events.createdAt} >= ${now.toISOString()}::timestamptz - make_interval(days => ${lookbackDays})
        and ${events.createdAt} < ${now.toISOString()}::timestamptz
        and (
          (${events.source} = 'console' and ${this.templates.id} is not null and ${events.organizationId} is distinct from ${this.templates.organizationId})
          or (${events.source} = 'awesome_akash' and ${events.templateRef} ~ ${AWESOME_AKASH_ID_PATTERN})
        )
    `;
  }
}
