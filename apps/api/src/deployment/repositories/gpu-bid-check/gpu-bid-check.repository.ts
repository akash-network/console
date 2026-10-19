import { lt } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["GpuBidChecks"];
export type GpuBidCheckInput = Partial<Table["$inferInsert"]>;
export type GpuBidCheckInsert = Table["$inferInsert"];
export type GpuBidCheckOutput = Table["$inferSelect"];

@singleton()
export class GpuBidCheckRepository extends BaseRepository<Table, GpuBidCheckInput, GpuBidCheckOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("GpuBidChecks") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "GpuBidCheck", "GpuBidChecks");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new GpuBidCheckRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async insertMany(rows: GpuBidCheckInsert[]): Promise<void> {
    if (!rows.length) return;
    await this.cursor.insert(this.table).values(rows);
  }

  async deleteCheckedBefore(before: Date): Promise<void> {
    await this.cursor.delete(this.table).where(lt(this.table.checkedAt, before));
  }
}
