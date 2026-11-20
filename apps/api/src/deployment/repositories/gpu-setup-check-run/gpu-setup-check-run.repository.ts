import { count, gte } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["GpuSetupCheckRuns"];
export type GpuSetupCheckRunInput = Partial<Table["$inferInsert"]>;
export type GpuSetupCheckRunOutput = Table["$inferSelect"];

@singleton()
export class GpuSetupCheckRunRepository extends BaseRepository<Table, GpuSetupCheckRunInput, GpuSetupCheckRunOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("GpuSetupCheckRuns") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "GpuSetupCheckRun", "GpuSetupCheckRuns");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new GpuSetupCheckRunRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async countCreatedSince(since: Date): Promise<number> {
    const [row] = await this.cursor.select({ runs: count() }).from(this.table).where(gte(this.table.createdAt, since));
    return row.runs;
  }
}
