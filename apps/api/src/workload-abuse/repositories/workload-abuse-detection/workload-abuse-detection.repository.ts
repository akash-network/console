import { and, eq, gt } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["WorkloadAbuseDetections"];
export type WorkloadAbuseDetectionInput = Partial<Table["$inferInsert"]>;
export type WorkloadAbuseDetectionOutput = Table["$inferSelect"];

@singleton()
export class WorkloadAbuseDetectionRepository extends BaseRepository<Table, WorkloadAbuseDetectionInput, WorkloadAbuseDetectionOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("WorkloadAbuseDetections") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "WorkloadAbuseDetection", "WorkloadAbuseDetections");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new WorkloadAbuseDetectionRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async findRecentHardTargets({ since }: { since: Date }): Promise<Array<{ walletId: number; dseq: string }>> {
    return await this.cursor
      .selectDistinct({ walletId: this.table.walletId, dseq: this.table.dseq })
      .from(this.table)
      .where(and(eq(this.table.verdict, "hard"), gt(this.table.createdAt, since)));
  }
}
