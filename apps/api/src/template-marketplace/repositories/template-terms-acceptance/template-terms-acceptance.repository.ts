import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["TemplateTermsAcceptances"];

export type TemplateTermsAcceptanceInput = Pick<Table["$inferInsert"], "templateId" | "userId" | "organizationId" | "termsVersion">;

@singleton()
export class TemplateTermsAcceptanceRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("TemplateTermsAcceptances") private readonly table: Table,
    private readonly txManager: TxService
  ) {}

  async record(acceptance: TemplateTermsAcceptanceInput): Promise<void> {
    await (this.txManager.getPgTx() || this.pg).insert(this.table).values(acceptance);
  }
}
