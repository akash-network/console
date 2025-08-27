import { eq } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

export type StripeTransactionInput = Partial<ApiPgTables["StripeTransactions"]["$inferInsert"]>;
export type StripeTransactionOutput = ApiPgTables["StripeTransactions"]["$inferSelect"];

@singleton()
export class StripeTransactionRepository extends BaseRepository<ApiPgTables["StripeTransactions"], StripeTransactionInput, StripeTransactionOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("StripeTransactions") protected readonly table: ApiPgTables["StripeTransactions"],
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "StripeTransaction", "StripeTransactions");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new StripeTransactionRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async findByStripeTransactionId(stripeTransactionId: string): Promise<StripeTransactionOutput | undefined> {
    const items = await this.cursor
      .select()
      .from(this.table)
      .where(this.whereAccessibleBy(eq(this.table.stripeTransactionId, stripeTransactionId)))
      .limit(1);

    if (!items.length) return undefined;
    return this.toOutput(items[0]);
  }

  async findByUserId(userId: string): Promise<StripeTransactionOutput[]> {
    const items = await this.cursor
      .select()
      .from(this.table)
      .where(this.whereAccessibleBy(eq(this.table.userId, userId)))
      .orderBy(this.table.stripeCreatedAt);

    return this.toOutputList(items);
  }

  async findByStripeCustomerId(stripeCustomerId: string): Promise<StripeTransactionOutput[]> {
    const items = await this.cursor
      .select()
      .from(this.table)
      .where(this.whereAccessibleBy(eq(this.table.stripeCustomerId, stripeCustomerId)))
      .orderBy(this.table.stripeCreatedAt);

    return this.toOutputList(items);
  }

  async countSuccessfulTransactionsByUserId(userId: string): Promise<number> {
    const result = await this.cursor
      .select({ count: this.table.id })
      .from(this.table)
      .where(this.whereAccessibleBy(eq(this.table.userId, userId)));

    return result.length;
  }

  async countSuccessfulTransactionsByStripeCustomerId(stripeCustomerId: string): Promise<number> {
    const result = await this.cursor
      .select({ count: this.table.id })
      .from(this.table)
      .where(this.whereAccessibleBy(eq(this.table.stripeCustomerId, stripeCustomerId)));

    return result.length;
  }
}
