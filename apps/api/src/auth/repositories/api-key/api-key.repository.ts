import { eq, lt, sql } from "drizzle-orm";
import { and } from "drizzle-orm";
import { singleton } from "tsyringe";

import { ApiPgDatabase, ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["ApiKeys"];
export type ApiKeyInput = Partial<Table["$inferInsert"]>;
export type ApiKeyDbOutput = Table["$inferSelect"];

export type ApiKeyOutput = Omit<ApiKeyDbOutput, "createdAt" | "updatedAt" | "expiresAt" | "lastUsedAt"> & {
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
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

  async markAsUsed(id: ApiKeyOutput["id"], throttleTimeSeconds: number) {
    await this.cursor
      .update(this.table)
      .set({ lastUsedAt: sql`now()` })
      .where(and(eq(this.table.id, id), lt(this.table.lastUsedAt, sql`now() - make_interval(secs => ${throttleTimeSeconds})`)));
  }

  protected toOutput(payload: ApiKeyDbOutput): ApiKeyOutput {
    return {
      ...payload,
      createdAt: payload.createdAt.toISOString(),
      updatedAt: payload.updatedAt.toISOString(),
      expiresAt: payload.expiresAt?.toISOString() ?? null,
      lastUsedAt: payload.lastUsedAt?.toISOString() ?? null
    };
  }
}
