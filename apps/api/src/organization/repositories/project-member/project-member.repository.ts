import { and, asc, eq, inArray, isNull, ne, notInArray, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { OrganizationMembers } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { Projects } from "@src/organization/model-schemas/project/project.schema";
import { GRANT_HOLDING_ORGANIZATION_ROLES } from "@src/organization/model-schemas/project-member/project-member.schema";
import { Users } from "@src/user/model-schemas/user/user.schema";

type Table = ApiPgTables["ProjectMembers"];
export type ProjectMemberInput = Table["$inferInsert"];
export type ProjectMemberOutput = Table["$inferSelect"];

export type ProjectMemberWithUser = ProjectMemberOutput & { username: string | null; email: string | null };

export type ProjectGrantOfMember = Pick<ProjectMemberOutput, "projectId" | "role">;

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

  /** Skips every project the user already holds a grant in, so a repeated call never aborts the caller's transaction. */
  async createManyUnlessExist(inputs: Pick<ProjectMemberInput, "organizationId" | "projectId" | "userId" | "role">[]): Promise<ProjectMemberOutput[]> {
    if (inputs.length === 0) return [];

    const values = await Promise.all(inputs.map(input => this.attributeToOrganization(input)));
    values.forEach(value => this.ability?.throwUnlessCanExecute(value));
    const created = await this.cursor
      .insert(this.table)
      .values(values)
      .onConflictDoNothing({ target: [this.table.projectId, this.table.userId] })
      .returning();

    return this.toOutputList(created);
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

  /** Leaves the user exactly the given grants in the organization: the others are removed, and the given ones created or changed to the given role. */
  async replaceGrantsOf({ organizationId, userId }: Pick<ProjectMemberInput, "organizationId" | "userId">, grants: ProjectGrantOfMember[]): Promise<void> {
    const projectIds = grants.map(grant => grant.projectId);
    await this.cursor
      .delete(this.table)
      .where(
        this.whereAccessibleBy(
          and(
            eq(this.table.organizationId, organizationId),
            eq(this.table.userId, userId),
            projectIds.length > 0 ? notInArray(this.table.projectId, projectIds) : undefined
          )
        )
      );

    if (grants.length === 0) return;

    const values = await Promise.all(grants.map(({ projectId, role }) => this.attributeToOrganization({ organizationId, userId, projectId, role })));
    values.forEach(value => this.ability?.throwUnlessCanExecute(value));
    await this.cursor
      .insert(this.table)
      .values(values)
      .onConflictDoUpdate({ target: [this.table.projectId, this.table.userId], set: { role: sql`excluded.role`, updatedAt: sql`now()` } });
  }

  /** Keeps the project-admin grants, which add rights on top of reaching every project. */
  async deleteGrantsBelowAdminOf({ organizationId, userId }: Pick<ProjectMemberInput, "organizationId" | "userId">): Promise<void> {
    await this.cursor
      .delete(this.table)
      .where(this.whereAccessibleBy(and(eq(this.table.organizationId, organizationId), eq(this.table.userId, userId), ne(this.table.role, "admin"))));
  }

  /** Every grant the user holds on a live project of the organization, whatever their organization role. */
  async findLiveGrantsOf(organizationId: ProjectMemberOutput["organizationId"], userId: ProjectMemberOutput["userId"]): Promise<ProjectGrantOfMember[]> {
    return await this.cursor
      .select({ projectId: this.table.projectId, role: this.table.role })
      .from(this.table)
      .innerJoin(Projects, and(eq(Projects.organizationId, this.table.organizationId), eq(Projects.id, this.table.projectId)))
      .where(this.whereAccessibleBy(and(eq(this.table.organizationId, organizationId), eq(this.table.userId, userId), isNull(Projects.deletedAt))))
      .orderBy(asc(this.table.createdAt), asc(this.table.id));
  }

  async findOfLiveProjects(query: { id: ProjectMemberOutput["id"] } | { projectId: ProjectMemberOutput["projectId"] }): Promise<ProjectMemberWithUser[]> {
    const rows = await this.cursor
      .select({ grant: this.table, username: Users.username, email: Users.email })
      .from(this.table)
      .innerJoin(Projects, and(eq(Projects.organizationId, this.table.organizationId), eq(Projects.id, this.table.projectId)))
      .innerJoin(Users, eq(Users.id, this.table.userId))
      .innerJoin(OrganizationMembers, and(eq(OrganizationMembers.organizationId, this.table.organizationId), eq(OrganizationMembers.userId, this.table.userId)))
      .where(
        this.whereAccessibleBy(
          and(
            isNull(Projects.deletedAt),
            inArray(OrganizationMembers.role, GRANT_HOLDING_ORGANIZATION_ROLES),
            "id" in query ? eq(this.table.id, query.id) : eq(this.table.projectId, query.projectId)
          )
        )
      )
      .orderBy(asc(this.table.createdAt), asc(this.table.id));

    return rows.map(({ grant, username, email }) => ({ ...this.toOutput(grant), username, email }));
  }
}
