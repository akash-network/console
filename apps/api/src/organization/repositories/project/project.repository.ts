import { and, eq, isNull } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import { DEFAULT_PROJECT_NAME, DEFAULT_PROJECT_SLUG } from "@src/organization/model-schemas/project/project.schema";
import { ProjectMembers } from "@src/organization/model-schemas/project-member/project-member.schema";

type Table = ApiPgTables["Projects"];
export type ProjectInput = Table["$inferInsert"];
export type ProjectOutput = Table["$inferSelect"];

@singleton()
export class ProjectRepository extends BaseRepository<Table, ProjectInput, ProjectOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("Projects") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "Project", "Projects");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new ProjectRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  /** Returns nothing when the organization already has its default project, so a repeated call never aborts the caller's transaction. */
  async createDefaultUnlessExists(input: Pick<ProjectInput, "organizationId" | "createdByUserId">): Promise<ProjectOutput | undefined> {
    const values = { ...input, name: DEFAULT_PROJECT_NAME, slug: DEFAULT_PROJECT_SLUG, isDefault: true };
    this.ability?.throwUnlessCanExecute(values);
    const [created] = await this.cursor.insert(this.table).values(values).onConflictDoNothing().returning();

    return created && this.toOutput(created);
  }

  async findDefaultByOrganizationId(organizationId: ProjectOutput["organizationId"]): Promise<ProjectOutput | undefined> {
    return this.findOneBy({ organizationId, isDefault: true });
  }

  async findActive(organizationId: ProjectOutput["organizationId"], id: ProjectOutput["id"]): Promise<ProjectOutput | undefined> {
    return this.findOneBy({ id, organizationId, deletedAt: null });
  }

  async findActiveIdsGrantedTo(organizationId: ProjectOutput["organizationId"], userId: string): Promise<string[]> {
    const projects = await this.cursor
      .select({ id: this.table.id })
      .from(this.table)
      .innerJoin(ProjectMembers, and(eq(ProjectMembers.projectId, this.table.id), eq(ProjectMembers.userId, userId)))
      .where(and(eq(this.table.organizationId, organizationId), isNull(this.table.deletedAt)));

    return projects.map(project => project.id);
  }
}
