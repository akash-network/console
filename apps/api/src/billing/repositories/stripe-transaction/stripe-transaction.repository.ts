import { and, count, desc, eq, exists, gt, gte, inArray, isNotNull, lt, lte, notInArray, or, SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { singleton } from "tsyringe";

import { type BillingOwner, ownedBy } from "@src/billing/lib/billing-owner/billing-owner";
import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { Users } from "@src/user/model-schemas";

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

/** A pending claim older than this is stale: without an invoice it stops holding the coupon, with one its invoice decides. */
const PENDING_COUPON_CLAIM_HOLD = sql`interval '1 hour'`;

/** A person's claim of a coupon under another payer, which holds the coupon unless it is stale and its invoice was never paid. */
export interface CouponClaimHold {
  id: string;
  status: StripeTransactionStatus;
  stripeInvoiceId: string | null;
  isStale: boolean;
}

export interface FindTransactionsOptions {
  owner: BillingOwner;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  status?: StripeTransactionStatus;
}

/** The member who acted for each row, so an organization's history shows who bought what. */
export type StripeTransactionWithInitiator = StripeTransactionOutput & {
  initiatedBy: { id: string; username: string | null; email: string | null } | null;
};

@singleton()
export class StripeTransactionRepository extends OrgScopedRepository<Table, StripeTransactionInput, StripeTransactionOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("StripeTransactions") protected readonly table: Table,
    protected readonly txManager: TxService,
    protected readonly executionContextService: ExecutionContextService
  ) {
    super(pg, table, txManager, executionContextService, "StripeTransaction", "StripeTransactions");
  }

  protected newInstance() {
    return new StripeTransactionRepository(this.pg, this.table, this.txManager, this.executionContextService) as this;
  }

  async findByOwner(options: FindTransactionsOptions): Promise<StripeTransactionWithInitiator[]> {
    const rows = await this.cursor
      .select({ transaction: this.table, initiator: { id: Users.id, username: Users.username, email: Users.email } })
      .from(this.table)
      .leftJoin(Users, eq(Users.id, this.table.userId))
      .where(this.whereAccessibleBy(this.#ownedWithin(options)))
      .orderBy(desc(this.table.createdAt))
      .limit(options.limit ?? 100)
      .offset(options.offset ?? 0);

    return rows.map(({ transaction, initiator }) => ({ ...this.toOutput(transaction), initiatedBy: initiator }));
  }

  #ownedWithin(options: Pick<FindTransactionsOptions, "owner" | "startDate" | "endDate" | "status">): SQL | undefined {
    return and(
      ownedBy(this.table, options.owner),
      options.startDate && gte(this.table.createdAt, options.startDate),
      options.endDate && lte(this.table.createdAt, options.endDate),
      options.status && eq(this.table.status, options.status)
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

    const [created] = await this.cursor
      .insert(this.table)
      .values(await this.attributeToOrganization(input))
      .onConflictDoNothing()
      .returning();

    if (created) {
      return { transaction: this.toOutput(created), isNew: true };
    }

    const winner = await this.findOneBy({ stripeIdempotencyKey: input.stripeIdempotencyKey, userId: input.userId });

    return { transaction: this.requireWrittenRow(winner), isNew: false };
  }

  /**
   * Atomically updates a row unless a webhook already settled it (see SETTLED_TRANSACTION_STATUSES),
   * so a slow request path can never downgrade a status the webhook wrote first. Returns the updated
   * row, or undefined when the guard suppressed the write.
   */
  async updateByIdUnlessSettled(id: StripeTransactionOutput["id"], update: Partial<StripeTransactionInput>): Promise<StripeTransactionOutput | undefined> {
    const [item] = await this.updateWhere(
      this.whereAccessibleBy(and(eq(this.table.id, id), notInArray(this.table.status, [...SETTLED_TRANSACTION_STATUSES]))),
      update,
      { returning: true }
    );

    return item ? this.toOutput(item) : undefined;
  }

  /** Holds until the ambient transaction ends, so one person's claims of one coupon are checked and recorded one at a time. */
  async lockCouponClaims(userId: string, couponId: string): Promise<void> {
    const tx = this.txManager.getPgTx();

    if (!tx) {
      throw new Error(`Coupon claims of user ${userId} can only be locked inside a transaction`);
    }

    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${userId}:${couponId}`}))`);
  }

  /** Reads every organization, so a coupon a person claimed under one payer is seen when they redeem it under another. */
  async findCouponClaimsOutside(input: { userId: string; couponId: string; owner: BillingOwner }): Promise<CouponClaimHold[]> {
    return await this.cursor
      .select({
        id: this.table.id,
        status: this.table.status,
        stripeInvoiceId: this.table.stripeInvoiceId,
        isStale: sql<boolean>`${this.table.createdAt} <= now() - ${PENDING_COUPON_CLAIM_HOLD}`
      })
      .from(this.table)
      .where(
        this.unscoped("per-person-billing-limits").whereAccessibleBy(
          and(
            eq(this.table.userId, input.userId),
            eq(this.table.type, "coupon_claim"),
            eq(this.table.stripeCouponId, input.couponId),
            or(
              inArray(this.table.status, [...SETTLED_TRANSACTION_STATUSES]),
              and(
                eq(this.table.status, "pending"),
                or(isNotNull(this.table.stripeInvoiceId), gt(this.table.createdAt, sql`now() - ${PENDING_COUPON_CLAIM_HOLD}`))
              )
            ),
            sql`not coalesce(${ownedBy(this.table, input.owner)}, false)`
          )
        )
      );
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

  async hasCompletedPaidTransactionBefore(transactionId: StripeTransactionOutput["id"]): Promise<boolean> {
    const currentTransaction = alias(this.table, "current_transaction");
    const [item] = await this.cursor
      .select({ id: this.table.id })
      .from(this.table)
      .innerJoin(currentTransaction, and(eq(currentTransaction.userId, this.table.userId), lt(this.table.createdAt, currentTransaction.createdAt)))
      .where(
        this.whereAccessibleBy(
          and(eq(currentTransaction.id, transactionId), eq(this.table.type, "payment_intent"), inArray(this.table.status, ["succeeded", "refunded"]))
        )
      )
      .limit(1);

    return !!item;
  }

  /**
   * Whether any account on the domain has ever made a real purchase. Manual credits and coupon claims
   * deliberately do not count: both are granted to trial users, so counting them would let a comped
   * account shield a domain from being blocked.
   */
  async hasPaidUserWithEmailDomain(domain: string): Promise<boolean> {
    const [match] = await this.cursor
      .select({ id: Users.id })
      .from(Users)
      .where(
        and(
          sql`lower(${Users.email}) LIKE ${"%@"} || ${domain}`,
          exists(
            this.cursor
              .select({ id: this.table.id })
              .from(this.table)
              .where(
                this.unscoped("email-domain-account-checks").whereAccessibleBy(
                  and(eq(this.table.userId, Users.id), eq(this.table.type, "payment_intent"), inArray(this.table.status, ["succeeded", "refunded"]))
                )
              )
          )
        )
      )
      .limit(1);

    return !!match;
  }

  async countByOwner(owner: BillingOwner, options?: { startDate?: Date; endDate?: Date }): Promise<number> {
    const [{ total }] = await this.cursor
      .select({ total: count() })
      .from(this.table)
      .where(this.whereAccessibleBy(this.#ownedWithin({ owner, ...options })));

    return total;
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
