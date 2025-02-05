import { singleton } from "tsyringe";

import { ApiPgDatabase, ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["ApiKeys"];
export type ApiKeyInput = Partial<Table["$inferInsert"]>;
export type ApiKeyDbOutput = Table["$inferSelect"];

export type ApiKeyOutput = Omit<ApiKeyDbOutput, "createdAt" | "updatedAt" | "expiresAt"> & {
  createdAt: string;
  updatedAt: string | null;
  expiresAt: string | null;
};

@singleton()
export class ApiKeyRepository extends BaseRepository<Table, ApiKeyInput, ApiKeyOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("ApiKeys") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "ApiKey", "ApiKeys");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new ApiKeyRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  protected toOutput(payload: ApiKeyDbOutput): ApiKeyOutput {
    return payload
      ? {
          ...payload,
          createdAt: payload.createdAt.toISOString(),
          updatedAt: payload.updatedAt.toISOString(),
          expiresAt: payload.expiresAt?.toISOString() ?? null
        }
      : undefined;
  }
}
