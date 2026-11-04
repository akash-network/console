import { and, asc, desc, eq, gt } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";

type Table = ApiPgTables["HardwareRequests"];
export type HardwareRequestInput = Partial<Table["$inferInsert"]>;
export type HardwareRequestDbOutput = Table["$inferSelect"];

export type HardwareRequestOutput = Omit<HardwareRequestDbOutput, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

const MAX_LISTED_REQUESTS = 100;

@singleton()
export class HardwareRequestRepository extends OrgScopedRepository<Table, HardwareRequestInput, HardwareRequestOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("HardwareRequests") protected readonly table: Table,
    protected readonly txManager: TxService,
    protected readonly executionContextService: ExecutionContextService
  ) {
    super(pg, table, txManager, executionContextService, "HardwareRequest", "HardwareRequests");
  }

  protected newInstance() {
    return new HardwareRequestRepository(this.pg, this.table, this.txManager, this.executionContextService) as this;
  }

  async findCreationTimesSince(userId: string, since: Date): Promise<Date[]> {
    const rows = await this.cursor
      .select({ createdAt: this.table.createdAt })
      .from(this.table)
      .where(and(eq(this.table.userId, userId), gt(this.table.createdAt, since)))
      .orderBy(asc(this.table.createdAt));

    return rows.map(row => row.createdAt);
  }

  async findNewestFirst(): Promise<HardwareRequestOutput[]> {
    const rows = await this.cursor
      .select()
      .from(this.table)
      .where(this.whereAccessibleBy(undefined))
      .orderBy(desc(this.table.createdAt))
      .limit(MAX_LISTED_REQUESTS);

    return this.toOutputList(rows);
  }

  protected toOutput(payload: HardwareRequestDbOutput): HardwareRequestOutput {
    return {
      ...payload,
      createdAt: payload.createdAt.toISOString(),
      updatedAt: payload.updatedAt.toISOString()
    };
  }
}
