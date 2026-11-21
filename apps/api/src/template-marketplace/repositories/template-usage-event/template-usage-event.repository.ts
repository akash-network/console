import { and, desc, eq, gte, inArray, isNotNull, or, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";
import { publiclyReadableTemplate } from "@src/template-marketplace/repositories/marketplace-template/publicly-readable-template";

type Table = ApiPgTables["TemplateUsageEvents"];
type TemplateVersionsTable = ApiPgTables["TemplateVersions"];
type TemplatesTable = ApiPgTables["Templates"];

export type TemplateUsageEventInput = Omit<Table["$inferInsert"], "id">;

export type TemplateUsageSummary = { deploys: number; lastDeployedAt: Date | null; stillUpAfter24h: number | null };

export type WatchedTemplate = { templateId: string; currentVersionId: string };

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

  /** Answers whether the event was new, since a deployment records each action once however often its create or lease settles. */
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

  /** Counts the people who deployed the template on mainnet in the last week from outside the organization that publishes it, which cannot make its own template popular. */
  async countWeeklyDeployers(templateId: string, publishingOrganizationId: string): Promise<number> {
    const [{ deployers }] = await this.#cursor
      .select({ deployers: this.#distinctDeployers })
      .from(this.table)
      .where(and(this.#weeklyDeploys, eq(this.table.templateRef, templateId), sql`${this.table.organizationId} is distinct from ${publishingOrganizationId}`));

    return deployers;
  }

  /** Lists the public templates whose images are worth watching, most deployed first: the Official ones and those with at least the given weekly deployers. */
  async findWatchedTemplates({ minWeeklyDeployers, limit }: { minWeeklyDeployers: number; limit: number }): Promise<WatchedTemplate[]> {
    const rows = await this.#cursor
      .select({ templateId: this.templates.id, currentVersionId: this.templates.currentVersionId })
      .from(this.templates)
      .leftJoin(
        this.table,
        and(
          this.#weeklyDeploys,
          eq(this.table.templateRef, sql`${this.templates.id}::text`),
          sql`${this.table.organizationId} is distinct from ${this.templates.organizationId}`
        )
      )
      .where(and(publiclyReadableTemplate(), isNotNull(this.templates.currentVersionId)))
      .groupBy(this.templates.id)
      .having(or(eq(this.templates.isOfficial, true), gte(this.#distinctDeployers, minWeeklyDeployers)))
      .orderBy(desc(this.#distinctDeployers), this.templates.id)
      .limit(limit);

    return rows.map(({ templateId, currentVersionId }) => ({ templateId, currentVersionId: currentVersionId! }));
  }

  get #distinctDeployers() {
    return sql<number>`count(distinct ${this.table.userId})`.mapWith(Number);
  }

  get #weeklyDeploys() {
    return and(this.#shownTemplateEvents, eq(this.table.action, "deploy"), gte(this.table.createdAt, sql`now() - interval '7 days'`));
  }

  get #shownTemplateEvents() {
    return and(eq(this.table.source, "console"), eq(this.table.network, SHOWN_NETWORK));
  }
}

function stillUpShare(stillRunning: number, dayOldLeases: number): number | null {
  return dayOldLeases < MIN_DAY_OLD_LEASES_FOR_STILL_UP_SHARE ? null : stillRunning / dayOldLeases;
}
