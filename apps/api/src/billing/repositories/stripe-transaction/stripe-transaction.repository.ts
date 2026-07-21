import { and, desc, eq, gte, inArray, lte, notInArray, SQL, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["StripeTransactions"];
export type StripeTransactionInput = Table["$inferInsert"];
export type StripeTransactionOutput = Table["$inferSelect"];

export type StripeTransactionStatus = StripeTransactionOutput["status"];
export type StripeTransactionType = StripeTransactionOutput["type"];

/**
 * Credit-grant transaction types whose crediting must never graduate a trial user. A granted manual
 * credit tops up the wallet without ending the trial; a redeemed coupon deliberately ends it (see #3403).
 * Add new trial-preserving credit-grant types here.
 */
export const TRIAL_PRESERVING_TRANSACTION_TYPES: Set<StripeTransactionType> = new Set(["manual_credit"]);

/**
 * Statuses written by Stripe webhooks once money has actually moved (wallet credited, then possibly
 * clawed back). Rows in these statuses must never be rewritten by the payment-intent request path:
 * the webhook's `status !== "succeeded"` guard is what makes crediting exactly-once. `failed` and
 * `canceled` intentionally stay updatable so a retried attempt can resume them.
 */
export const SETTLED_TRANSACTION_STATUSES: Set<StripeTransactionStatus> = new Set(["succeeded", "refunded"]);

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

  async findByChargeIds(chargeIds: string[]): Promise<StripeTransactionOutput[]> {
    if (!chargeIds.length) return [];

    return this.toOutputList(
      await this.cursor.query.StripeTransactions.findMany({
        where: this.whereAccessibleBy(inArray(this.table.stripeChargeId, chargeIds))
      })
    );
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

  /**
   * Finds the transaction recorded for a Stripe idempotency key or creates it, resolving concurrent
   * inserts through the partial unique index (conflict-do-nothing, then re-fetch the winner).
   */
  async findOrCreateByIdempotencyKey(
    input: StripeTransactionInput & { stripeIdempotencyKey: string }
  ): Promise<{ transaction: StripeTransactionOutput; isNew: boolean }> {
    const existing = await this.findOneBy({ stripeIdempotencyKey: input.stripeIdempotencyKey, userId: input.userId });

    if (existing) {
      return { transaction: existing, isNew: false };
    }

    const [created] = await this.cursor.insert(this.table).values(input).onConflictDoNothing().returning();

    if (created) {
      return { transaction: this.toOutput(created), isNew: true };
    }

    const winner = await this.findOneBy({ stripeIdempotencyKey: input.stripeIdempotencyKey, userId: input.userId });

    if (!winner) {
      throw new Error(`Stripe transaction not found after idempotency key conflict resolution. userId: ${input.userId}`);
    }

    return { transaction: winner, isNew: false };
  }

  /**
   * Atomically updates a row unless a webhook already settled it (see SETTLED_TRANSACTION_STATUSES),
   * so a slow request path can never downgrade a status the webhook wrote first. Returns the updated
   * row, or undefined when the guard suppressed the write.
   */
  async updateByIdUnlessSettled(id: StripeTransactionOutput["id"], update: Partial<StripeTransactionInput>): Promise<StripeTransactionOutput | undefined> {
    const [item] = await this.cursor
      .update(this.table)
      .set({ ...update, updatedAt: sql`now()` })
      .where(and(eq(this.table.id, id), notInArray(this.table.status, [...SETTLED_TRANSACTION_STATUSES])))
      .returning();

    return item ? this.toOutput(item) : undefined;
  }

  /**
   * Whether the user has ever completed a paid purchase (`payment_intent` transaction that
   * succeeded, including ones refunded afterwards). Coupon claims never count.
   */
  async hasCompletedPaidTransaction(userId: string): Promise<boolean> {
    const item = await this.cursor.query.StripeTransactions.findFirst({
      where: this.whereAccessibleBy(
        and(eq(this.table.userId, userId), eq(this.table.type, "payment_intent"), inArray(this.table.status, ["succeeded", "refunded"]))
      ),
      columns: { id: true }
    });

    return !!item;
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
