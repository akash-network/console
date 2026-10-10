import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";

type Table = ApiPgTables["ProjectMembers"];
export type ProjectMemberInput = Table["$inferInsert"];
export type ProjectMemberOutput = Table["$inferSelect"];

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
}
