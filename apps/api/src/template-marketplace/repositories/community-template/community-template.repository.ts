import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";
import type { TemplateHardware } from "@src/template/types/template";
import { listedTemplate } from "@src/template-marketplace/repositories/marketplace-template/publicly-readable-template";
import { isCountedForTemplate, namesTemplateUsage } from "@src/template-marketplace/repositories/marketplace-template/template-usage-reference";

export type CommunityTemplateRow = {
  id: string;
  title: string;
  summary: string | null;
  icon: string | null;
  categories: string[];
  isOfficial: boolean;
  isFeatured: boolean;
  /** The awesome-akash gallery id of a template the import owns, null for every other. */
  importedRef: string | null;
  publishedAt: Date;
  updatedAt: Date;
  publisher: { name: string; handle: string; isVerified: boolean };
  resources: TemplateHardware | null;
  /** Read only for a version that recorded no resources, so a listing never carries every SDL. */
  sdlWithoutResources: string | null;
  versionCount: number;
  /** Null while the recompute job has counted no usage for the template. */
  score: { popularScore: number; trendingScore: number; isTrending: boolean } | null;
};

export type CommunityTemplateFilter = { organizationId?: string; limit: number };

export type PublisherCounts = { templates: number; deploys: number };

const COUNTED_NETWORK = "mainnet";

function byNewestPublished(left: CommunityTemplateRow, right: CommunityTemplateRow): number {
  return right.publishedAt.getTime() - left.publishedAt.getTime() || left.id.localeCompare(right.id);
}

@singleton()
export class CommunityTemplateRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("Templates") private readonly templates: ApiPgTables["Templates"],
    @InjectPgTable("TemplateVersions") private readonly versions: ApiPgTables["TemplateVersions"],
    @InjectPgTable("Organizations") private readonly organizations: ApiPgTables["Organizations"],
    @InjectPgTable("TemplatePublishers") private readonly publishers: ApiPgTables["TemplatePublishers"],
    @InjectPgTable("TemplateUsageEvents") private readonly usageEvents: ApiPgTables["TemplateUsageEvents"],
    @InjectPgTable("TemplateScores") private readonly scores: ApiPgTables["TemplateScores"],
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  /** Past the limit the least popular templates are the ones left out, and what is kept reads newest first. */
  async list({ organizationId, limit }: CommunityTemplateFilter): Promise<CommunityTemplateRow[]> {
    const rows = await this.#cursor
      .select({
        id: this.templates.id,
        title: this.templates.title,
        summary: this.templates.summary,
        icon: this.templates.icon,
        categories: this.templates.categories,
        isOfficial: this.templates.isOfficial,
        isFeatured: this.templates.isFeatured,
        importedRef: this.templates.importedRef,
        publishedAt: this.templates.publishedAt,
        updatedAt: this.templates.updatedAt,
        publisher: { name: this.organizations.name, handle: this.publishers.handle, isVerified: this.publishers.isVerified },
        resources: this.versions.resources,
        sdlWithoutResources: sql<string | null>`case when ${this.versions.resources} is null then ${this.versions.sdl} end`,
        versionCount: sql<number>`(
          select count(*) from ${this.versions}
          where ${this.versions.templateId} = ${this.templates.id} and ${this.versions.status} = 'live'
        )`.mapWith(Number),
        popularScore: this.scores.popularScore,
        trendingScore: this.scores.trendingScore,
        isTrending: this.scores.isTrending
      })
      .from(this.templates)
      .innerJoin(this.versions, this.#isLiveCurrentVersion)
      .innerJoin(this.organizations, and(eq(this.organizations.id, this.templates.organizationId), isNull(this.organizations.deletedAt)))
      .innerJoin(this.publishers, eq(this.publishers.organizationId, this.templates.organizationId))
      .leftJoin(this.scores, namesTemplateUsage(this.scores.source, this.scores.templateRef))
      .where(and(listedTemplate(), organizationId ? eq(this.templates.organizationId, organizationId) : undefined))
      .orderBy(sql`coalesce(${this.scores.popularScore}, 0) desc`, desc(this.templates.publishedAt), this.templates.id)
      .limit(limit);

    return rows
      .map(({ popularScore, trendingScore, isTrending, ...row }) => ({
        ...row,
        publishedAt: row.publishedAt!,
        score: popularScore === null ? null : { popularScore, trendingScore: trendingScore!, isTrending: isTrending! }
      }))
      .sort(byNewestPublished);
  }

  async countOfPublisher(organizationId: string): Promise<PublisherCounts> {
    const [counts] = await this.#cursor
      .select({
        templates: sql<number>`count(distinct ${this.templates.id})`.mapWith(Number),
        deploys: sql<number>`count(${this.usageEvents.id})`.mapWith(Number)
      })
      .from(this.templates)
      .innerJoin(this.versions, this.#isLiveCurrentVersion)
      .leftJoin(
        this.usageEvents,
        and(
          namesTemplateUsage(this.usageEvents.source, this.usageEvents.templateRef),
          eq(this.usageEvents.action, "deploy"),
          eq(this.usageEvents.network, COUNTED_NETWORK),
          isCountedForTemplate(this.usageEvents.organizationId)
        )
      )
      .where(and(listedTemplate(), eq(this.templates.organizationId, organizationId)));

    return counts;
  }

  get #isLiveCurrentVersion() {
    return and(eq(this.versions.id, this.templates.currentVersionId), eq(this.versions.status, "live"));
  }
}
