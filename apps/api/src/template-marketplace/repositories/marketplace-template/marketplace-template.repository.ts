import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm/sql/sql";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { OrganizationType } from "@src/organization/model-schemas/organization/organization.schema";
import type { TemplateVersionStatus } from "@src/template-marketplace/model-schemas/template-version/template-version.schema";
import type { TemplateVisibility } from "@src/user/model-schemas/template/template.schema";

type Table = ApiPgTables["Templates"];
type Row = Table["$inferSelect"];

export type MarketplaceTemplateRow = Row & {
  authorUsername: string | null;
  publisher: { name: string; slug: string; type: OrganizationType } | null;
};

export type NewTemplateInput = {
  title: string;
  summary: string | null;
  icon?: string;
  categories?: string[];
  userId: string;
  authorId: string;
  projectId?: string;
  copiedFromId?: string;
  sdl: string;
  description: string;
  cpu: number;
  ram: number;
  storage: number;
};

export type TemplateVersionMirror = Pick<Row, "sdl" | "cpu" | "ram" | "storage"> & { description: string };

export type TemplateSettingsUpdate = Partial<Pick<Row, "title" | "summary" | "icon" | "categories" | "visibility" | "isPublic">>;

export type UserTemplateListFilter = {
  organizationId: string;
  visibility?: TemplateVisibility;
  projectId?: string;
  limit: number;
};

export type UserTemplateListRow = Pick<
  Row,
  | "id"
  | "userId"
  | "organizationId"
  | "projectId"
  | "copiedFromId"
  | "title"
  | "summary"
  | "icon"
  | "categories"
  | "visibility"
  | "isListed"
  | "moderationStatus"
  | "updatedAt"
> & {
  currentVersion: { version: number; status: TemplateVersionStatus; createdAt: Date } | null;
  lastEditedByUsername: string | null;
};

@singleton()
export class MarketplaceTemplateRepository extends OrgScopedRepository<Table, Partial<Row>, Row> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("Templates") protected readonly table: Table,
    @InjectPgTable("Users") private readonly users: ApiPgTables["Users"],
    @InjectPgTable("Organizations") private readonly organizations: ApiPgTables["Organizations"],
    @InjectPgTable("TemplateVersions") private readonly versions: ApiPgTables["TemplateVersions"],
    protected readonly txManager: TxService,
    protected readonly executionContextService: ExecutionContextService
  ) {
    super(pg, table, txManager, executionContextService, "Template", "Templates");
  }

  protected newInstance() {
    return new MarketplaceTemplateRepository(
      this.pg,
      this.table,
      this.users,
      this.organizations,
      this.versions,
      this.txManager,
      this.executionContextService
    ) as this;
  }

  protected get filesIntoProjects() {
    return true;
  }

  async createTemplate(input: NewTemplateInput): Promise<string> {
    const created = await this.create({ ...input, visibility: "private", isPublic: false, isListed: true });

    return created.id;
  }

  /** Unscoped, so it must run only after the writer has authorized the change to this template. */
  async mirrorVersion(id: string, mirror: TemplateVersionMirror): Promise<void> {
    await this.unscoped("template-writers").updateById(id, mirror);
  }

  /** Unscoped, so the writer must hold the locked row to the active organization and its rules before writing. */
  async findAndLockForWrite(id: string): Promise<Row | undefined> {
    return await this.unscoped("template-writers").findOneByAndLock({ id }, { strength: "no key update" });
  }

  /** Unscoped, so it must run only after the writer has authorized the change to this template. */
  async updateSettings(id: string, settings: TemplateSettingsUpdate): Promise<void> {
    await this.unscoped("template-writers").updateById(id, settings);
  }

  /** Unscoped, so it must run only after the writer has authorized the delete; versions and favorites cascade. */
  async deleteTemplate(id: string): Promise<void> {
    await this.unscoped("template-writers").deleteById(id);
  }

  /** Names the organization in every mode, since legacy rules on templates are keyed on their author and reach every organization. */
  async listInOrganization({ organizationId, visibility, projectId, limit }: UserTemplateListFilter): Promise<UserTemplateListRow[]> {
    return await this.cursor
      .select({
        id: this.table.id,
        userId: this.table.userId,
        organizationId: this.table.organizationId,
        projectId: this.table.projectId,
        copiedFromId: this.table.copiedFromId,
        title: this.table.title,
        summary: this.table.summary,
        icon: this.table.icon,
        categories: this.table.categories,
        visibility: this.table.visibility,
        isListed: this.table.isListed,
        moderationStatus: this.table.moderationStatus,
        updatedAt: this.table.updatedAt,
        currentVersion: { version: this.versions.version, status: this.versions.status, createdAt: this.versions.createdAt },
        lastEditedByUsername: this.users.username
      })
      .from(this.table)
      .leftJoin(this.versions, eq(this.versions.id, this.table.currentVersionId))
      .leftJoin(this.users, eq(this.users.id, this.versions.createdById))
      .where(
        this.whereAccessibleBy(
          and(
            eq(this.table.organizationId, organizationId),
            ne(this.table.moderationStatus, "removed"),
            visibility ? eq(this.table.visibility, visibility) : undefined,
            projectId ? eq(this.table.projectId, projectId) : undefined
          )
        )
      )
      .orderBy(desc(this.table.updatedAt))
      .limit(limit);
  }

  async findReadable(id: string): Promise<MarketplaceTemplateRow | undefined> {
    const [result] = await this.cursor
      .select({
        template: this.table,
        authorUsername: this.users.username,
        publisherName: this.organizations.name,
        publisherSlug: this.organizations.slug,
        publisherType: this.organizations.type
      })
      .from(this.table)
      .leftJoin(this.users, eq(this.users.id, this.table.authorId))
      .leftJoin(this.organizations, eq(this.organizations.id, this.table.organizationId))
      .where(and(eq(this.table.id, id), ne(this.table.moderationStatus, "removed"), or(this.#publiclyReadable(), this.#readableThroughRules())))
      .limit(1);

    if (!result) return undefined;

    const { template, authorUsername, publisherName, publisherSlug, publisherType } = result;

    return {
      ...template,
      authorUsername,
      publisher: publisherName && publisherSlug && publisherType ? { name: publisherName, slug: publisherSlug, type: publisherType } : null
    };
  }

  #publiclyReadable(): SQL | undefined {
    return and(eq(this.table.visibility, "public"), eq(this.table.moderationStatus, "active"));
  }

  /** Rules name the organizations they reach, so this branch skips the active-organization narrowing, and a rule with no conditions reads every template. */
  #readableThroughRules(): SQL | undefined {
    if (!this.ability) return undefined;

    return this.unscoped("template-readers").whereAccessibleBy(undefined) ?? sql`true`;
  }
}
