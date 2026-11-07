import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["TemplateUsageEvents"];
type TemplateVersionsTable = ApiPgTables["TemplateVersions"];
type TemplatesTable = ApiPgTables["Templates"];

export type TemplateUsageEventInput = Omit<Table["$inferInsert"], "id" | "createdAt">;

export type TemplateUsageSummary = { deploys: number; lastDeployedAt: Date | null; stillUpAfter24h: number | null };

export const NO_TEMPLATE_USAGE: TemplateUsageSummary = { deploys: 0, lastDeployedAt: null, stillUpAfter24h: null };

/** Below this many day-old leases a still-up share swings too far on one deployment to show. */
const MIN_DAY_OLD_LEASES_FOR_STILL_UP_SHARE = 5;

const SHOWN_NETWORK = "mainnet";

@singleton()
export class TemplateUsageEventRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("TemplateUsageEvents") private readonly table: Table,
    @InjectPgTable("TemplateVersions") private readonly templateVersions: TemplateVersionsTable,
    @InjectPgTable("Templates") private readonly templates: TemplatesTable,
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  /** Answers whether the event was new, since a deployment records each action once, and a user each favorite and unfavorite of a template once. */
  async record(event: TemplateUsageEventInput): Promise<boolean> {
    const recorded = await this.#cursor.insert(this.table).values(event).onConflictDoNothing().returning({ id: this.table.id });

    return recorded.length > 0;
  }

  async findTemplateIdOfVersion(versionId: string): Promise<string | undefined> {
    const [version] = await this.#cursor
      .select({ templateId: this.templateVersions.templateId })
      .from(this.templateVersions)
      .where(eq(this.templateVersions.id, versionId));

    return version?.templateId;
  }

  async findCurrentVersionIdOfTemplate(templateId: string): Promise<string | null> {
    const [template] = await this.#cursor
      .select({ currentVersionId: this.templates.currentVersionId })
      .from(this.templates)
      .where(eq(this.templates.id, templateId));

    return template?.currentVersionId ?? null;
  }

  /** Counts Console templates' mainnet events only, so testnet and sandbox trials never inflate what pages show. */
  async summarize(templateIds: string[]): Promise<Map<string, TemplateUsageSummary>> {
    if (!templateIds.length) return new Map();

    const { action, createdAt } = this.table;
    const rows = await this.#cursor
      .select({
        templateRef: this.table.templateRef,
        deploys: sql<number>`count(*) filter (where ${action} = 'deploy')`.mapWith(Number),
        lastDeployedAt: sql<Date | null>`max(${createdAt}) filter (where ${action} = 'deploy')`.mapWith(createdAt),
        dayOldLeases: sql<number>`count(*) filter (where ${action} = 'lease_created' and ${createdAt} <= now() - interval '24 hours')`.mapWith(Number),
        stillRunning: sql<number>`count(*) filter (where ${action} = 'still_running_24h')`.mapWith(Number)
      })
      .from(this.table)
      .where(
        and(
          this.#shownTemplateEvents,
          inArray(this.table.templateRef, templateIds),
          inArray(this.table.action, ["deploy", "lease_created", "still_running_24h"])
        )
      )
      .groupBy(this.table.templateRef);
    const summaries = new Map(templateIds.map(id => [id, NO_TEMPLATE_USAGE]));

    for (const { templateRef, deploys, lastDeployedAt, dayOldLeases, stillRunning } of rows) {
      summaries.set(templateRef, { deploys, lastDeployedAt, stillUpAfter24h: stillUpShare(stillRunning, dayOldLeases) });
    }

    return summaries;
  }

  async countDeploysByVersion(templateId: string): Promise<Map<string, number>> {
    const rows = await this.#cursor
      .select({ versionId: this.table.templateVersionId, deploys: sql<number>`count(*)`.mapWith(Number) })
      .from(this.table)
      .where(and(this.#shownTemplateEvents, eq(this.table.templateRef, templateId), eq(this.table.action, "deploy"), isNotNull(this.table.templateVersionId)))
      .groupBy(this.table.templateVersionId);

    return new Map(rows.map(({ versionId, deploys }) => [versionId!, deploys]));
  }

  get #shownTemplateEvents() {
    return and(eq(this.table.source, "console"), eq(this.table.network, SHOWN_NETWORK));
  }
}

/** A still-running event can land before its lease event is a day old, so the share is capped at one. */
function stillUpShare(stillRunning: number, dayOldLeases: number): number | null {
  return dayOldLeases < MIN_DAY_OLD_LEASES_FOR_STILL_UP_SHARE ? null : Math.min(1, stillRunning / dayOldLeases);
}
