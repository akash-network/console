import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";

type Table = ApiPgTables["ProjectBudgets"];
export type ProjectBudgetInput = Table["$inferInsert"];
export type ProjectBudgetOutput = Table["$inferSelect"];

export const PROJECT_BUDGET_UNIQUE_CONSTRAINT = "project_budgets_organization_id_project_id_unique";

@singleton()
export class ProjectBudgetRepository extends OrgScopedRepository<Table, ProjectBudgetInput, ProjectBudgetOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("ProjectBudgets") protected readonly table: Table,
    protected readonly txManager: TxService,
    protected readonly executionContextService: ExecutionContextService
  ) {
    super(pg, table, txManager, executionContextService, "ProjectBudget", "ProjectBudgets");
  }

  protected newInstance() {
    return new ProjectBudgetRepository(this.pg, this.table, this.txManager, this.executionContextService) as this;
  }
}
