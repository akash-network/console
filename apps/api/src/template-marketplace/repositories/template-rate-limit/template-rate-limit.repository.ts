import { and, desc, eq, gt, type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

export const RATE_LIMITED_TEMPLATE_ACTIONS = ["create", "version", "publish", "report"] as const;

export type RateLimitedTemplateAction = (typeof RATE_LIMITED_TEMPLATE_ACTIONS)[number];

export type RateLimitScope = { userId: string } | { organizationId: string };

export type SlidingWindowLimit = { max: number; windowSeconds: number };

type CountedRows = { happenedAt: PgColumn; where: SQL | undefined; joinsTemplates?: boolean };

@singleton()
export class TemplateRateLimitRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("Templates") private readonly templates: ApiPgTables["Templates"],
    @InjectPgTable("TemplateVersions") private readonly versions: ApiPgTables["TemplateVersions"],
    @InjectPgTable("TemplateTermsAcceptances") private readonly acceptances: ApiPgTables["TemplateTermsAcceptances"],
    @InjectPgTable("TemplateReports") private readonly reports: ApiPgTables["TemplateReports"],
    private readonly txManager: TxService
  ) {}

  /** Counts the rows the action itself leaves behind, so answers the seconds until the oldest one over the limit leaves the window, or nothing while there is room. */
  async findSecondsUntilRoom(
    action: RateLimitedTemplateAction,
    scope: RateLimitScope,
    { max, windowSeconds }: SlidingWindowLimit
  ): Promise<number | undefined> {
    const { happenedAt, where, joinsTemplates } = this.#countedRows(action, scope);
    const window = sql`make_interval(secs => ${windowSeconds})`;
    const cursor = this.txManager.getPgTx() || this.pg;
    const base = cursor.select({ secondsUntilRoom: sql<string>`ceil(extract(epoch from ${happenedAt} + ${window} - now()))` }).from(happenedAt.table);
    const counted = joinsTemplates ? base.innerJoin(this.templates, eq(this.templates.id, this.versions.templateId)) : base;
    const [newestOverLimit] = await counted
      .where(and(where, gt(happenedAt, sql`now() - ${window}`)))
      .orderBy(desc(happenedAt))
      .offset(max - 1)
      .limit(1);

    return newestOverLimit ? Math.max(1, Number(newestOverLimit.secondsUntilRoom)) : undefined;
  }

  /** A template's first version is counted as the template it comes with, so creating one never uses up version saves. */
  #countedRows(action: RateLimitedTemplateAction, scope: RateLimitScope): CountedRows {
    const isLaterVersion = gt(this.versions.version, 1);

    if ("userId" in scope) {
      return {
        create: { happenedAt: this.templates.createdAt, where: eq(this.templates.authorId, scope.userId) },
        version: { happenedAt: this.versions.createdAt, where: and(eq(this.versions.createdById, scope.userId), isLaterVersion) },
        publish: { happenedAt: this.acceptances.acceptedAt, where: eq(this.acceptances.userId, scope.userId) },
        report: { happenedAt: this.reports.createdAt, where: eq(this.reports.reporterUserId, scope.userId) }
      }[action];
    }

    return {
      create: { happenedAt: this.templates.createdAt, where: eq(this.templates.organizationId, scope.organizationId) },
      version: {
        happenedAt: this.versions.createdAt,
        where: and(eq(this.templates.organizationId, scope.organizationId), isLaterVersion),
        joinsTemplates: true
      },
      publish: { happenedAt: this.acceptances.acceptedAt, where: eq(this.acceptances.organizationId, scope.organizationId) },
      report: { happenedAt: this.reports.createdAt, where: eq(this.reports.reporterOrganizationId, scope.organizationId) }
    }[action];
  }
}
