import { eq } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

export type StripeCouponInput = Partial<ApiPgTables["StripeCoupons"]["$inferInsert"]>;
export type StripeCouponOutput = ApiPgTables["StripeCoupons"]["$inferSelect"];

@singleton()
export class StripeCouponRepository extends BaseRepository<ApiPgTables["StripeCoupons"], StripeCouponInput, StripeCouponOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("StripeCoupons") protected readonly table: ApiPgTables["StripeCoupons"],
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "StripeCoupon", "StripeCoupons");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new StripeCouponRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async findByStripeCouponId(stripeCouponId: string): Promise<StripeCouponOutput | undefined> {
    const items = await this.cursor
      .select()
      .from(this.table)
      .where(this.whereAccessibleBy(eq(this.table.stripeCouponId, stripeCouponId)))
      .limit(1);

    if (!items.length) return undefined;
    return this.toOutput(items[0]);
  }

  async findByUserId(userId: string): Promise<StripeCouponOutput[]> {
    const items = await this.cursor
      .select()
      .from(this.table)
      .where(this.whereAccessibleBy(eq(this.table.userId, userId)))
      .orderBy(this.table.stripeCreatedAt);

    return this.toOutputList(items);
  }
}
