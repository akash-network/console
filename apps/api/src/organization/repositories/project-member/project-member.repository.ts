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
}
