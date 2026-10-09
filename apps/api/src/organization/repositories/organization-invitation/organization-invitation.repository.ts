import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";

type Table = ApiPgTables["OrganizationInvitations"];
export type OrganizationInvitationInput = Table["$inferInsert"];
export type OrganizationInvitationOutput = Table["$inferSelect"];

@singleton()
export class OrganizationInvitationRepository extends OrgScopedRepository<Table, OrganizationInvitationInput, OrganizationInvitationOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("OrganizationInvitations") protected readonly table: Table,
    protected readonly txManager: TxService,
    protected readonly executionContextService: ExecutionContextService
  ) {
    super(pg, table, txManager, executionContextService, "OrganizationInvitation", "OrganizationInvitations");
  }

  protected newInstance() {
    return new OrganizationInvitationRepository(this.pg, this.table, this.txManager, this.executionContextService) as this;
  }
}
