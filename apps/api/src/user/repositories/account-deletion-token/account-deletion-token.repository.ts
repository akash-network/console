import { eq, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["AccountDeletionTokens"];
export type AccountDeletionTokenInput = Partial<Table["$inferInsert"]>;
export type AccountDeletionTokenOutput = Table["$inferSelect"];

@singleton()
export class AccountDeletionTokenRepository extends BaseRepository<Table, AccountDeletionTokenInput, AccountDeletionTokenOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("AccountDeletionTokens") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "AccountDeletionToken", "AccountDeletionTokens");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new AccountDeletionTokenRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async replaceForUser(input: { userId: string; tokenHash: string; acknowledgedForfeitUsd: number; expiresAt: Date }): Promise<AccountDeletionTokenOutput> {
    const [token] = await this.cursor
      .insert(this.table)
      .values(input)
      .onConflictDoUpdate({
        target: this.table.userId,
        set: {
          tokenHash: input.tokenHash,
          acknowledgedForfeitUsd: input.acknowledgedForfeitUsd,
          expiresAt: input.expiresAt,
          createdAt: sql`now()`
        }
      })
      .returning();

    return token;
  }

  async findByTokenHash(tokenHash: string): Promise<AccountDeletionTokenOutput | undefined> {
    const [token] = await this.cursor.select().from(this.table).where(eq(this.table.tokenHash, tokenHash));

    return token;
  }

  async findByUserId(userId: string): Promise<AccountDeletionTokenOutput | undefined> {
    const [token] = await this.cursor.select().from(this.table).where(eq(this.table.userId, userId));

    return token;
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.cursor.delete(this.table).where(eq(this.table.userId, userId));
  }
}
