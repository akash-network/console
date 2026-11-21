import { eq } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["TemplateModerationEvents"];

export type TemplateModerationEventOutput = Table["$inferSelect"];

/** Reads only: the admin app writes each event in the transaction that applies the action it records. */
@singleton()
export class TemplateModerationEventRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("TemplateModerationEvents") private readonly table: Table,
    private readonly txManager: TxService
  ) {}

  async findById(id: string): Promise<TemplateModerationEventOutput | undefined> {
    const cursor = this.txManager.getPgTx() || this.pg;
    const [event] = await cursor.select().from(this.table).where(eq(this.table.id, id)).limit(1);

    return event;
  }
}
