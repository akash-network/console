import { asc } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["FavoriteProviders"];
export type FavoriteProviderInput = Partial<Table["$inferInsert"]>;
export type FavoriteProviderOutput = Table["$inferSelect"];

@singleton()
export class FavoriteProviderRepository extends BaseRepository<Table, FavoriteProviderInput, FavoriteProviderOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("FavoriteProviders") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "FavoriteProvider", "FavoriteProviders");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new FavoriteProviderRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  /** In the order they were starred, so a list that outgrows what one search takes keeps the oldest favorites in it. */
  async findAddresses(): Promise<string[]> {
    const rows = await this.cursor
      .select({ providerAddress: this.table.providerAddress })
      .from(this.table)
      .where(this.whereAccessibleBy(undefined))
      .orderBy(asc(this.table.createdAt), asc(this.table.id));

    return rows.map(row => row.providerAddress);
  }

  /** Starring a provider twice keeps the first star, so its place in the list does not move. */
  async addAll(userId: string, providerAddresses: string[]): Promise<void> {
    const rows = providerAddresses.map(providerAddress => ({ userId, providerAddress }));
    rows.forEach(row => this.ability?.throwUnlessCanExecute(row));

    await this.cursor
      .insert(this.table)
      .values(rows)
      .onConflictDoNothing({ target: [this.table.userId, this.table.providerAddress] });
  }
}
