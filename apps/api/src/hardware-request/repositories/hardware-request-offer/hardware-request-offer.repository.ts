import { asc, eq } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["HardwareRequestOffers"];
type Row = Table["$inferSelect"];
export type HardwareRequestOfferInput = Table["$inferInsert"];
export type HardwareRequestOfferOutput = Omit<Row, "expiresAt" | "publishedAt" | "createdAt" | "updatedAt"> & {
  expiresAt: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

@singleton()
export class HardwareRequestOfferRepository extends BaseRepository<Table, HardwareRequestOfferInput, HardwareRequestOfferOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("HardwareRequestOffers") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "HardwareRequestOffer", "HardwareRequestOffers");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new HardwareRequestOfferRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async findOldestFirst(hardwareRequestId: string): Promise<HardwareRequestOfferOutput[]> {
    const rows = await this.cursor.select().from(this.table).where(eq(this.table.hardwareRequestId, hardwareRequestId)).orderBy(asc(this.table.createdAt));

    return this.toOutputList(rows);
  }

  protected toOutput(row: Row): HardwareRequestOfferOutput {
    return {
      ...row,
      expiresAt: row.expiresAt.toISOString(),
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }
}
