import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import type { HardwareRequestEventPayloads, HardwareRequestEventType } from "@src/hardware-request/model-schemas";

type Table = ApiPgTables["HardwareRequestEvents"];
export type HardwareRequestEventInput = Table["$inferInsert"];
export type HardwareRequestEventOutput = Omit<Table["$inferSelect"], "createdAt"> & { createdAt: string };

export type HardwareRequestEventRecord<T extends HardwareRequestEventType> = {
  hardwareRequestId: string;
  type: T;
  actor: string | null;
  payload: HardwareRequestEventPayloads[T];
};

@singleton()
export class HardwareRequestEventRepository extends BaseRepository<Table, HardwareRequestEventInput, HardwareRequestEventOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("HardwareRequestEvents") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "HardwareRequestEvent", "HardwareRequestEvents");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new HardwareRequestEventRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async record<T extends HardwareRequestEventType>(event: HardwareRequestEventRecord<T>): Promise<HardwareRequestEventOutput> {
    return await this.create(event);
  }

  protected toOutput(payload: Table["$inferSelect"]): HardwareRequestEventOutput {
    return { ...payload, createdAt: payload.createdAt.toISOString() };
  }
}
