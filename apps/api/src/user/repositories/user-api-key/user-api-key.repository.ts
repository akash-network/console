import { singleton } from "tsyringe";

import { ApiPgDatabase, ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["UserApiKeys"];
export type UserApiKeyInput = Partial<Table["$inferInsert"]>;
export type UserApiKeyDbOutput = Table["$inferSelect"];
export type UserApiKeyOutput = Omit<UserApiKeyDbOutput, "createdAt" | "updatedAt" | "expiresAt"> & {
  createdAt: string;
  updatedAt: string | null;
  expiresAt: string | null;
};

@singleton()
export class UserApiKeyRepository extends BaseRepository<Table, UserApiKeyInput, UserApiKeyOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("UserApiKeys") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "UserApiKey", "UserApiKeys");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new UserApiKeyRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  protected toOutput(payload: UserApiKeyDbOutput): UserApiKeyOutput {
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
