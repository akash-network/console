import { and, desc, eq, exists, gte, inArray, isNotNull, lt, ne, or, type SQL, sql } from "drizzle-orm";
import { alias, type PgColumn } from "drizzle-orm/pg-core";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";
import type { TemplateUsageAction } from "@src/template-marketplace/model-schemas/template-usage-event/template-usage-event.schema";
import { publiclyReadableTemplate } from "@src/template-marketplace/repositories/marketplace-template/publicly-readable-template";

type Table = ApiPgTables["TemplateUsageEvents"];
type TemplateVersionsTable = ApiPgTables["TemplateVersions"];
type TemplatesTable = ApiPgTables["Templates"];
type TemplateViewEventsTable = ApiPgTables["TemplateViewEvents"];

export type TemplateUsageEventInput = Omit<Table["$inferInsert"], "id">;

export type ForkEventInput = Pick<TemplateUsageEventInput, "templateRef" | "templateVersionId" | "organizationId" | "network"> & { userId: string };

export type TemplateUsageSummary = { deploys: number; lastDeployedAt: Date | null; stillUpAfter24h: number | null; forks: number };

export type WatchedTemplate = { templateId: string; currentVersionId: string };

export type VersionedTemplate = { templateId: string; versionNumber: number; isOfficial: boolean; visibility: TemplatesTable["$inferSelect"]["visibility"] };

export type DeployCohortCounts = { deploys: number; leases: number; decidedLeases: number; stillRunning: number };

export type DailyDeployCohort = DeployCohortCounts & { day: string };

export type VersionDeployCohort = DeployCohortCounts & { version: number };

export type DailyForkCount = { day: string; forks: number };

export type ActivePublicTemplate = { id: string; title: string; organizationId: string };

export const NO_TEMPLATE_USAGE: TemplateUsageSummary = { deploys: 0, lastDeployedAt: null, stillUpAfter24h: null, forks: 0 };

const SUMMARIZED_ACTIONS: TemplateUsageAction[] = ["deploy", "lease_created", "still_running_24h", "fork"];

const AWESOME_AKASH_ID_PATTERN = "^[A-Za-z0-9][A-Za-z0-9._-]*$";

type UsageCounts = { deploys: number; lastDeployedAt: Date | null; dayOldLeases: number; stillRunning: number; forks: number };

/** Below this many day-old leases a still-up share swings too far on one deployment to show. */
const MIN_DAY_OLD_LEASES_FOR_STILL_UP_SHARE = 5;

export const SHOWN_NETWORK = "mainnet";

const LEASE_DECIDED_AFTER = sql`interval '24 hours'`;

@singleton()
export class TemplateUsageEventRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("TemplateUsageEvents") private readonly table: Table,
    @InjectPgTable("TemplateVersions") private readonly templateVersions: TemplateVersionsTable,
    @InjectPgTable("Templates") private readonly templates: TemplatesTable,
    @InjectPgTable("TemplateViewEvents") private readonly templateViewEvents: TemplateViewEventsTable,
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

  async findTemplateOfVersion(versionId: string): Promise<VersionedTemplate | undefined> {
    const [version] = await this.#cursor
      .select({
        templateId: this.templateVersions.templateId,
        versionNumber: this.templateVersions.version,
        isOfficial: this.templates.isOfficial,
        visibility: this.templates.visibility
      })
      .from(this.templateVersions)
      .innerJoin(this.templates, eq(this.templates.id, this.templateVersions.templateId))
      .where(eq(this.templateVersions.id, versionId));

    return version;
  }

  async findCurrentVersionIdOfTemplate(templateId: string): Promise<string | null> {
    const [template] = await this.#cursor
      .select({ currentVersionId: this.templates.currentVersionId })
      .from(this.templates)
      .where(eq(this.templates.id, templateId));

    return template?.currentVersionId ?? null;
  }

  /** The caller's transaction must hold the user's row, or two forks made at once would both find none counted in the last 24 hours. */
  async recordForkOncePerDay(fork: ForkEventInput): Promise<boolean> {
    const [counted] = await this.#cursor
      .select({ id: this.table.id })
      .from(this.table)
      .where(
        and(
          eq(this.table.source, "console"),
          eq(this.table.templateRef, fork.templateRef),
          eq(this.table.action, "fork"),
          eq(this.table.userId, fork.userId),
          eq(this.table.network, fork.network),
          gte(this.table.createdAt, sql`now() - interval '24 hours'`)
        )
      )
      .limit(1);

    return counted ? false : await this.record({ ...fork, source: "console", action: "fork" });
  }

  /** Counts Console templates' mainnet events only, so testnet and sandbox trials never inflate what pages show, and leaves a public template's own organization out of its numbers. */
  async summarize(templateIds: string[]): Promise<Map<string, TemplateUsageSummary>> {
    if (!templateIds.length) return new Map();

    const rows = await this.#cursor
      .select({ templateRef: this.table.templateRef, ...this.#usageCounts })
      .from(this.table)
      .innerJoin(this.templates, eq(this.table.templateRef, sql`${this.templates.id}::text`))
      .where(
        and(this.#shownTemplateEvents, inArray(this.templates.id, templateIds), inArray(this.table.action, SUMMARIZED_ACTIONS), this.#countedForItsTemplate)
      )
      .groupBy(this.table.templateRef);
    const summaries = new Map(templateIds.map(id => [id, NO_TEMPLATE_USAGE]));

    for (const { templateRef, ...counts } of rows) {
      summaries.set(templateRef, toUsageSummary(counts));
    }

    return summaries;
  }

  /** Reads the most deployed awesome-akash templates by the id their deployments named, which nothing checks against the gallery, so only ids shaped like the gallery's are answered. */
  async summarizeAwesomeAkash(limit: number): Promise<Map<string, TemplateUsageSummary>> {
    const rows = await this.#cursor
      .select({ templateRef: this.table.templateRef, ...this.#usageCounts })
      .from(this.table)
      .where(
        and(
          eq(this.table.source, "awesome_akash"),
          eq(this.table.network, SHOWN_NETWORK),
          inArray(this.table.action, SUMMARIZED_ACTIONS),
          sql`${this.table.templateRef} ~ ${AWESOME_AKASH_ID_PATTERN}`
        )
      )
      .groupBy(this.table.templateRef)
      .orderBy(desc(this.#usageCounts.deploys), this.table.templateRef)
      .limit(limit);

    return new Map(rows.map(({ templateRef, ...counts }) => [templateRef, toUsageSummary(counts)]));
  }

  /** Leaves out what the template's own count leaves out, so its versions add up to it. */
  async countDeploysByVersion(templateId: string): Promise<Map<string, number>> {
    const rows = await this.#cursor
      .select({ versionId: this.table.templateVersionId, deploys: sql<number>`count(*)`.mapWith(Number) })
      .from(this.table)
      .innerJoin(this.templates, eq(this.templates.id, templateId))
      .where(
        and(
          this.#shownTemplateEvents,
          eq(this.table.templateRef, templateId),
          eq(this.table.action, "deploy"),
          isNotNull(this.table.templateVersionId),
          this.#countedForItsTemplate
        )
      )
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

  /** Follows each deployment made from the template since the given UTC day to whether it got a provider and was still running a day later, by the day it was made. */
  async countDailyDeployCohorts(templateId: string, since: string): Promise<DailyDeployCohort[]> {
    const day = this.#utcDayOf(this.table.createdAt);

    return await this.#selectDeployCohorts({ day }, and(eq(this.table.templateRef, templateId), gte(this.table.createdAt, this.#startOfUtcDay(since)))).groupBy(day);
  }

  /** Follows every deployment ever made from the template the same way, by the version it was made from. */
  async countDeployCohortsByVersion(templateId: string): Promise<VersionDeployCohort[]> {
    const version = sql<number>`${this.templateVersions.version}`.mapWith(Number);

    return await this.#selectDeployCohorts({ version }, and(eq(this.table.templateRef, templateId), isNotNull(this.templateVersions.version)))
      .groupBy(this.templateVersions.version)
      .orderBy(this.templateVersions.version);
  }

  async countDailyForks(templateId: string, since: string): Promise<DailyForkCount[]> {
    const day = this.#utcDayOf(this.table.createdAt);

    return await this.#cursor
      .select({ day, forks: sql<number>`count(*)`.mapWith(Number) })
      .from(this.table)
      .innerJoin(this.templates, eq(this.templates.id, templateId))
      .where(
        and(
          this.#shownTemplateEvents,
          eq(this.table.templateRef, templateId),
          eq(this.table.action, "fork"),
          gte(this.table.createdAt, this.#startOfUtcDay(since)),
          this.#countedForItsTemplate
        )
      )
      .groupBy(day);
  }

  /** Lists the publicly readable templates someone viewed on mainnet or deployed from outside their organization since the given UTC day, oldest first. */
  async findPublicTemplatesActiveSince(since: string, limit: number): Promise<ActivePublicTemplate[]> {
    const viewed = this.#cursor
      .select({ id: this.templateViewEvents.id })
      .from(this.templateViewEvents)
      .where(
        and(
          eq(this.templateViewEvents.templateId, this.templates.id),
          eq(this.templateViewEvents.network, SHOWN_NETWORK),
          gte(this.templateViewEvents.viewedOn, since)
        )
      );
    const deployed = this.#cursor
      .select({ id: this.table.id })
      .from(this.table)
      .where(
        and(
          this.#shownTemplateEvents,
          eq(this.table.templateRef, sql`${this.templates.id}::text`),
          eq(this.table.action, "deploy"),
          gte(this.table.createdAt, this.#startOfUtcDay(since)),
          this.#countedForItsTemplate
        )
      );

    return await this.#cursor
      .select({ id: this.templates.id, title: this.templates.title, organizationId: this.templates.organizationId })
      .from(this.templates)
      .where(and(publiclyReadableTemplate(), or(exists(viewed), exists(deployed))))
      .orderBy(this.templates.createdAt, this.templates.id)
      .limit(limit);
  }

  /** Counts the template's deployments made before the given UTC day the way its public deploy count does. */
  async countDeploysBefore(templateId: string, day: string): Promise<number> {
    const [{ deploys }] = await this.#cursor
      .select({ deploys: sql<number>`count(*)`.mapWith(Number) })
      .from(this.table)
      .innerJoin(this.templates, eq(this.templates.id, templateId))
      .where(
        and(
          this.#shownTemplateEvents,
          eq(this.table.templateRef, templateId),
          eq(this.table.action, "deploy"),
          lt(this.table.createdAt, this.#startOfUtcDay(day)),
          this.#countedForItsTemplate
        )
      );

    return deploys;
  }

  #selectDeployCohorts<TKey extends Record<string, SQL>>(key: TKey, scope: SQL | undefined) {
    const lease = alias(this.table, "lease");
    const stillRunning = alias(this.table, "still_running");

    return this.#cursor
      .select({
        ...key,
        deploys: sql<number>`count(*)`.mapWith(Number),
        leases: sql<number>`count(${lease.id})`.mapWith(Number),
        decidedLeases: sql<number>`count(${lease.id}) filter (where ${lease.createdAt} <= now() - ${LEASE_DECIDED_AFTER})`.mapWith(Number),
        stillRunning: sql<number>`count(${stillRunning.id})`.mapWith(Number)
      })
      .from(this.table)
      .innerJoin(this.templates, eq(this.table.templateRef, sql`${this.templates.id}::text`))
      .leftJoin(this.templateVersions, eq(this.templateVersions.id, this.table.templateVersionId))
      .leftJoin(lease, and(eq(lease.deploymentSettingId, this.table.deploymentSettingId), eq(lease.action, "lease_created")))
      .leftJoin(stillRunning, and(eq(stillRunning.deploymentSettingId, this.table.deploymentSettingId), eq(stillRunning.action, "still_running_24h")))
      .where(and(this.#shownTemplateEvents, eq(this.table.action, "deploy"), scope, this.#countedForItsTemplate));
  }

  #utcDayOf(timestamp: PgColumn) {
    return sql<string>`to_char(${timestamp} at time zone 'UTC', 'YYYY-MM-DD')`;
  }

  #startOfUtcDay(day: string) {
    return sql`(${day}::date)::timestamp at time zone 'UTC'`;
  }

  /** A public template's own organization cannot raise its numbers; a template only that organization can use has nobody else to count. */
  get #countedForItsTemplate() {
    return or(ne(this.templates.visibility, "public"), sql`${this.table.organizationId} is distinct from ${this.templates.organizationId}`);
  }

  get #usageCounts() {
    const { action, createdAt } = this.table;

    return {
      deploys: sql<number>`count(*) filter (where ${action} = 'deploy')`.mapWith(Number),
      lastDeployedAt: sql<Date | null>`max(${createdAt}) filter (where ${action} = 'deploy')`.mapWith(createdAt),
      dayOldLeases: sql<number>`count(*) filter (where ${action} = 'lease_created' and ${createdAt} <= now() - interval '24 hours')`.mapWith(Number),
      stillRunning: sql<number>`count(*) filter (where ${action} = 'still_running_24h')`.mapWith(Number),
      forks: sql<number>`count(*) filter (where ${action} = 'fork')`.mapWith(Number)
    };
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

function toUsageSummary({ deploys, lastDeployedAt, dayOldLeases, stillRunning, forks }: UsageCounts): TemplateUsageSummary {
  return { deploys, lastDeployedAt, stillUpAfter24h: stillUpShare(stillRunning, dayOldLeases), forks };
}

function stillUpShare(stillRunning: number, dayOldLeases: number): number | null {
  return dayOldLeases < MIN_DAY_OLD_LEASES_FOR_STILL_UP_SHARE ? null : stillRunning / dayOldLeases;
}
