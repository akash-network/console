import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { DEFAULT_PROJECT_NAME, DEFAULT_PROJECT_SLUG } from "@src/organization/model-schemas/project/project.schema";
import { ProjectMembers } from "@src/organization/model-schemas/project-member/project-member.schema";
import { Users } from "@src/user/model-schemas/user/user.schema";

type Table = ApiPgTables["Projects"];
export type ProjectInput = Table["$inferInsert"];
export type ProjectOutput = Table["$inferSelect"];

export type ProjectCreator = { id: string; username: string | null };

export type ProjectWithCreator = ProjectOutput & { createdBy: ProjectCreator | null };

@singleton()
export class ProjectRepository extends OrgScopedRepository<Table, ProjectInput, ProjectOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("Projects") protected readonly table: Table,
    protected readonly txManager: TxService,
    protected readonly executionContextService: ExecutionContextService
  ) {
    super(pg, table, txManager, executionContextService, "Project", "Projects");
  }

  protected newInstance() {
    return new ProjectRepository(this.pg, this.table, this.txManager, this.executionContextService) as this;
  }

  /** Returns nothing when the organization already has its default project, so a repeated call never aborts the caller's transaction. */
  async createDefaultUnlessExists(input: Pick<ProjectInput, "organizationId" | "createdByUserId">): Promise<ProjectOutput | undefined> {
    const values = await this.attributeToOrganization({ ...input, name: DEFAULT_PROJECT_NAME, slug: DEFAULT_PROJECT_SLUG, isDefault: true });
    this.ability?.throwUnlessCanExecute(values);
    const [created] = await this.cursor.insert(this.table).values(values).onConflictDoNothing().returning();

    return created && this.toOutput(created);
  }

  /** Takes the first slug no live project of the organization holds; a name already in use still fails with a unique violation. */
  async createWithFirstFreeSlug(input: Omit<ProjectInput, "slug">, slugs: string[]): Promise<ProjectOutput | undefined> {
    for (const slug of slugs) {
      const values = await this.attributeToOrganization({ ...input, slug });
      this.ability?.throwUnlessCanExecute(values);
      const [created] = await this.cursor
        .insert(this.table)
        .values(values)
        .onConflictDoNothing({ target: [this.table.organizationId, this.table.slug], where: sql`${this.table.deletedAt} IS NULL` })
        .returning();

      if (created) return this.toOutput(created);
    }

    return undefined;
  }

  async findDefaultByOrganizationId(organizationId: ProjectOutput["organizationId"]): Promise<ProjectOutput | undefined> {
    return this.findOneBy({ organizationId, isDefault: true });
  }

  async findActiveWithCreator(query: { id?: ProjectOutput["id"] } = {}): Promise<ProjectWithCreator[]> {
    const rows = await this.cursor
      .select({ project: this.table, creator: { id: Users.id, username: Users.username } })
      .from(this.table)
      .leftJoin(Users, eq(Users.id, this.table.createdByUserId))
      .where(this.whereAccessibleBy(and(isNull(this.table.deletedAt), query.id ? eq(this.table.id, query.id) : undefined)))
      .orderBy(desc(this.table.isDefault), asc(this.table.createdAt), asc(this.table.id));

    return rows.map(({ project, creator }) => ({ ...this.toOutput(project), createdBy: creator }));
  }

  async findActive(organizationId: ProjectOutput["organizationId"], id: ProjectOutput["id"]): Promise<ProjectOutput | undefined> {
    return this.unscoped("active-organization-resolution").findOneBy({ id, organizationId, deletedAt: null });
  }

  async findActiveIdsGrantedTo(organizationId: ProjectOutput["organizationId"], userId: string): Promise<string[]> {
    const projects = await this.cursor
      .select({ id: this.table.id })
      .from(this.table)
      .innerJoin(ProjectMembers, and(eq(ProjectMembers.projectId, this.table.id), eq(ProjectMembers.userId, userId)))
      .where(
        this.unscoped("active-organization-resolution").whereAccessibleBy(and(eq(this.table.organizationId, organizationId), isNull(this.table.deletedAt)))
      );

    return projects.map(project => project.id);
  }
}
