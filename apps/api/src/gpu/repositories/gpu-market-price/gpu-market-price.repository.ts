import { and, asc, eq, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService, WithTransaction } from "@src/core/services";

type Table = ApiPgTables["GpuMarketPrices"];
export type GpuMarketPriceInput = Partial<Table["$inferInsert"]>;
export type GpuMarketPriceInsert = Table["$inferInsert"];
export type GpuMarketPriceOutput = Table["$inferSelect"];

@singleton()
export class GpuMarketPriceRepository extends BaseRepository<Table, GpuMarketPriceInput, GpuMarketPriceOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("GpuMarketPrices") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "GpuMarketPrice", "GpuMarketPrices");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new GpuMarketPriceRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  /** Swaps every row in one transaction, so a reader never sees a half-written refresh. */
  @WithTransaction()
  async replaceAll(rows: GpuMarketPriceInsert[]): Promise<void> {
    await this.cursor.delete(this.table);
    if (rows.length) await this.cursor.insert(this.table).values(rows);
  }

  async findAllOrdered(filter: { vendor?: string; model?: string } = {}): Promise<GpuMarketPriceOutput[]> {
    return await this.cursor
      .select()
      .from(this.table)
      .where(
        and(
          filter.vendor ? eq(sql`lower(${this.table.vendor})`, filter.vendor.toLowerCase()) : undefined,
          filter.model ? eq(sql`lower(${this.table.model})`, filter.model.toLowerCase()) : undefined
        )
      )
      .orderBy(asc(this.table.vendor), asc(this.table.model), asc(this.table.ram), asc(this.table.interface), asc(this.table.area), asc(this.table.source));
  }
}
