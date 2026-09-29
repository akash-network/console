import { and, asc, eq, gt } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["HardwareRequests"];
export type HardwareRequestInput = Partial<Table["$inferInsert"]>;
export type HardwareRequestDbOutput = Table["$inferSelect"];

export type HardwareRequestOutput = Omit<HardwareRequestDbOutput, "createdAt"> & {
  createdAt: string;
};

@singleton()
export class HardwareRequestRepository extends BaseRepository<Table, HardwareRequestInput, HardwareRequestOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("HardwareRequests") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "HardwareRequest", "HardwareRequests");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new HardwareRequestRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async findCreationTimesSince(userId: string, since: Date): Promise<Date[]> {
    const rows = await this.cursor
      .select({ createdAt: this.table.createdAt })
      .from(this.table)
      .where(and(eq(this.table.userId, userId), gt(this.table.createdAt, since)))
      .orderBy(asc(this.table.createdAt));

    return rows.map(row => row.createdAt);
  }

  protected toOutput(payload: HardwareRequestDbOutput): HardwareRequestOutput {
    return {
      ...payload,
      createdAt: payload.createdAt.toISOString()
    };
  }
}
