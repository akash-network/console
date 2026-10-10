import { and, asc, eq, isNull } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { Projects } from "@src/organization/model-schemas/project/project.schema";
import { Users } from "@src/user/model-schemas/user/user.schema";

type Table = ApiPgTables["ProjectMembers"];
export type ProjectMemberInput = Table["$inferInsert"];
export type ProjectMemberOutput = Table["$inferSelect"];

export type ProjectMemberWithUser = ProjectMemberOutput & { username: string | null; email: string | null };

@singleton()
export class ProjectMemberRepository extends OrgScopedRepository<Table, ProjectMemberInput, ProjectMemberOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("ProjectMembers") protected readonly table: Table,
    protected readonly txManager: TxService,
    protected readonly executionContextService: ExecutionContextService
  ) {
    super(pg, table, txManager, executionContextService, "ProjectMember", "ProjectMembers");
  }

  protected newInstance() {
    return new ProjectMemberRepository(this.pg, this.table, this.txManager, this.executionContextService) as this;
  }

  /** Returns nothing when the user already holds a grant on the project, so a concurrent duplicate never aborts the caller's transaction. */
  async createUnlessExists(input: Pick<ProjectMemberInput, "organizationId" | "projectId" | "userId" | "role">): Promise<ProjectMemberOutput | undefined> {
    const values = await this.attributeToOrganization(input);
    this.ability?.throwUnlessCanExecute(values);
    const [created] = await this.cursor
      .insert(this.table)
      .values(values)
      .onConflictDoNothing({ target: [this.table.projectId, this.table.userId] })
      .returning();

    return created && this.toOutput(created);
  }

  async findOfLiveProjects(query: { id?: ProjectMemberOutput["id"]; projectId?: ProjectMemberOutput["projectId"] }): Promise<ProjectMemberWithUser[]> {
    const rows = await this.cursor
      .select({ grant: this.table, username: Users.username, email: Users.email })
      .from(this.table)
      .innerJoin(Projects, and(eq(Projects.organizationId, this.table.organizationId), eq(Projects.id, this.table.projectId)))
      .innerJoin(Users, eq(Users.id, this.table.userId))
      .where(
        this.whereAccessibleBy(
          and(
            isNull(Projects.deletedAt),
            query.id ? eq(this.table.id, query.id) : undefined,
            query.projectId ? eq(this.table.projectId, query.projectId) : undefined
          )
        )
      )
      .orderBy(asc(this.table.createdAt), asc(this.table.id));

    return rows.map(({ grant, username, email }) => ({ ...this.toOutput(grant), username, email }));
  }
}
