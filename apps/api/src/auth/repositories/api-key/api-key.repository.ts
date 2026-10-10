import { eq, isNull, lt, ne, or, sql } from "drizzle-orm";
import { and } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";

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
export class ApiKeyRepository extends OrgScopedRepository<Table, ApiKeyInput, ApiKeyOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("ApiKeys") protected readonly table: Table,
    protected readonly txManager: TxService,
    protected readonly executionContextService: ExecutionContextService
  ) {
    super(pg, table, txManager, executionContextService, "ApiKey", "ApiKeys");
  }

  protected newInstance() {
    return new ApiKeyRepository(this.pg, this.table, this.txManager, this.executionContextService) as this;
  }

  async findBcryptKeysByKeyFormat(keyFormat: string): Promise<ApiKeyOutput[]> {
    const isBcryptHashSql = sql`${this.table.hashedKey} LIKE '$2%'`;
    const items = await this.cursor
      .select()
      .from(this.table)
      .where(this.unscoped("api-key-authentication").whereAccessibleBy(and(eq(this.table.keyFormat, keyFormat), isBcryptHashSql)));
    return this.toOutputList(items);
  }

  async markAsUsed(id: ApiKeyOutput["id"], throttleTimeSeconds: number) {
    await this.cursor
      .update(this.table)
      .set({ lastUsedAt: sql`now()` })
      .where(
        this.unscoped("api-key-authentication").whereAccessibleBy(
          and(eq(this.table.id, id), or(isNull(this.table.lastUsedAt), lt(this.table.lastUsedAt, sql`now() - make_interval(secs => ${throttleTimeSeconds})`)))
        )
      );
  }

  async updateHash(id: ApiKeyOutput["id"], hashedKey: string): Promise<void> {
    await this.cursor
      .update(this.table)
      .set({ hashedKey })
      .where(this.unscoped("api-key-authentication").whereAccessibleBy(and(eq(this.table.id, id), ne(this.table.hashedKey, hashedKey))));
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
