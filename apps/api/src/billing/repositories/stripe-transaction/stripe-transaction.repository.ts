import { and, desc, eq, gte, lte, SQL } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["StripeTransactions"];
export type StripeTransactionInput = Table["$inferInsert"];
export type StripeTransactionOutput = Table["$inferSelect"];

export type StripeTransactionStatus = StripeTransactionOutput["status"];
export type StripeTransactionType = StripeTransactionOutput["type"];

export interface FindTransactionsOptions {
  userId: string;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  status?: StripeTransactionStatus;
}

@singleton()
export class StripeTransactionRepository extends BaseRepository<Table, StripeTransactionInput, StripeTransactionOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("StripeTransactions") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "StripeTransaction", "StripeTransactions");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new StripeTransactionRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async findByUserId(options: FindTransactionsOptions): Promise<StripeTransactionOutput[]> {
    const conditions: SQL[] = [eq(this.table.userId, options.userId)];

    if (options.startDate) {
      conditions.push(gte(this.table.createdAt, options.startDate));
    }

    if (options.endDate) {
      conditions.push(lte(this.table.createdAt, options.endDate));
    }

    if (options.status) {
      conditions.push(eq(this.table.status, options.status));
    }

    const where = this.whereAccessibleBy(and(...conditions));

    return this.toOutputList(
      await this.cursor.query.StripeTransactions.findMany({
        where,
        limit: options.limit ?? 100,
        offset: options.offset ?? 0,
        orderBy: [desc(this.table.createdAt)]
      })
    );
  }

  async findByPaymentIntentId(paymentIntentId: string): Promise<StripeTransactionOutput | undefined> {
    const item = await this.cursor.query.StripeTransactions.findFirst({
      where: this.whereAccessibleBy(eq(this.table.stripePaymentIntentId, paymentIntentId))
    });

    return item ? this.toOutput(item) : undefined;
  }

  async findByChargeId(chargeId: string): Promise<StripeTransactionOutput | undefined> {
    const item = await this.cursor.query.StripeTransactions.findFirst({
      where: this.whereAccessibleBy(eq(this.table.stripeChargeId, chargeId))
    });

    return item ? this.toOutput(item) : undefined;
  }

  async findByInvoiceId(invoiceId: string): Promise<StripeTransactionOutput | undefined> {
    const item = await this.cursor.query.StripeTransactions.findFirst({
      where: this.whereAccessibleBy(eq(this.table.stripeInvoiceId, invoiceId))
    });

    return item ? this.toOutput(item) : undefined;
  }

  async updateByPaymentIntentId(paymentIntentId: string, update: Partial<StripeTransactionInput>): Promise<StripeTransactionOutput | undefined> {
    const existing = await this.findByPaymentIntentId(paymentIntentId);
    if (!existing) return undefined;

    return this.updateById(existing.id, update, { returning: true });
  }

  async countByUserId(userId: string): Promise<number> {
    const items = await this.cursor.query.StripeTransactions.findMany({
      where: this.whereAccessibleBy(eq(this.table.userId, userId)),
      columns: { id: true }
    });

    return items.length;
  }

  async sumAmountByUserId(userId: string, options?: { startDate?: Date; endDate?: Date; status?: StripeTransactionStatus }): Promise<number> {
    const conditions: SQL[] = [eq(this.table.userId, userId)];

    if (options?.startDate) {
      conditions.push(gte(this.table.createdAt, options.startDate));
    }

    if (options?.endDate) {
      conditions.push(lte(this.table.createdAt, options.endDate));
    }

    if (options?.status) {
      conditions.push(eq(this.table.status, options.status));
    }

    const items = await this.cursor.query.StripeTransactions.findMany({
      where: this.whereAccessibleBy(and(...conditions)),
      columns: { amount: true }
    });

    return items.reduce((sum, item) => sum + item.amount, 0);
  }
}
