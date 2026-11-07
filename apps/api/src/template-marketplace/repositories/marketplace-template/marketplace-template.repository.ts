import { and, eq, ne, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm/sql/sql";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { OrganizationType } from "@src/organization/model-schemas/organization/organization.schema";

type Table = ApiPgTables["Templates"];
type Row = Table["$inferSelect"];

export type MarketplaceTemplateRow = Row & {
  authorUsername: string | null;
  publisher: { name: string; slug: string; type: OrganizationType } | null;
};

export type NewTemplateInput = {
  title: string;
  summary: string | null;
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

@singleton()
export class MarketplaceTemplateRepository extends OrgScopedRepository<Table, Partial<Row>, Row> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("Templates") protected readonly table: Table,
    @InjectPgTable("Users") private readonly users: ApiPgTables["Users"],
    @InjectPgTable("Organizations") private readonly organizations: ApiPgTables["Organizations"],
    protected readonly txManager: TxService,
    protected readonly executionContextService: ExecutionContextService
  ) {
    super(pg, table, txManager, executionContextService, "Template", "Templates");
  }

  protected newInstance() {
    return new MarketplaceTemplateRepository(this.pg, this.table, this.users, this.organizations, this.txManager, this.executionContextService) as this;
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
