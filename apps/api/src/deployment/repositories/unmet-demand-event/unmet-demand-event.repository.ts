import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["UnmetDemandEvents"];
export type UnmetDemandEventInput = Partial<Table["$inferInsert"]>;
export type UnmetDemandEventInsert = Table["$inferInsert"];
export type UnmetDemandEventOutput = Table["$inferSelect"];

@singleton()
export class UnmetDemandEventRepository extends BaseRepository<Table, UnmetDemandEventInput, UnmetDemandEventOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("UnmetDemandEvents") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "UnmetDemandEvent", "UnmetDemandEvents");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new UnmetDemandEventRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  /** Skips an event whose dedupe key is already stored, which is how a repeated ask counts once. */
  async insertMany(events: UnmetDemandEventInsert[]): Promise<void> {
    if (!events.length) return;
    await this.cursor.insert(this.table).values(events).onConflictDoNothing({ target: this.table.dedupeKey });
  }
}
