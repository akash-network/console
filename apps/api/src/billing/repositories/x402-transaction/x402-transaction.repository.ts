import { and, asc, eq, gte, lt, ne, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["X402Transactions"];
export type X402TransactionInput = Table["$inferInsert"];
export type X402TransactionOutput = Table["$inferSelect"];

export type X402TransactionStatus = X402TransactionOutput["status"];

@singleton()
export class X402TransactionRepository extends BaseRepository<Table, X402TransactionInput, X402TransactionOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("X402Transactions") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "X402Transaction", "X402Transactions");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new X402TransactionRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async findByPaymentHash(paymentHash: string): Promise<X402TransactionOutput | undefined> {
    const item = await this.cursor.query.X402Transactions.findFirst({
      where: this.whereAccessibleBy(eq(this.table.paymentHash, paymentHash))
    });

    return item ? this.toOutput(item) : undefined;
  }

  /**
   * Atomically transitions a transaction from `settled` to `succeeded`.
   *
   * The conditional `WHERE status = 'settled'` makes the credit exactly-once under concurrency:
   * only the caller whose UPDATE actually affects a row (rowCount 1) may go on to credit the wallet.
   * Any concurrent retry or the reconcile job observes rowCount 0 and must not credit.
   */
  async markSettledAsSucceeded(id: X402TransactionOutput["id"]): Promise<boolean> {
    const updated = await this.cursor
      .update(this.table)
      .set({ status: "succeeded", updatedAt: sql`now()` })
      .where(and(eq(this.table.id, id), eq(this.table.status, "settled")))
      .returning({ id: this.table.id });

    return updated.length === 1;
  }

  /**
   * Returns transactions stuck in `settled` (payment captured on-chain but wallet not yet credited)
   * whose last update is older than `olderThan`, oldest first — the reconcile job's work backlog.
   */
  async findStaleSettled(olderThan: Date, limit: number): Promise<X402TransactionOutput[]> {
    const items = await this.cursor.query.X402Transactions.findMany({
      where: this.whereAccessibleBy(and(eq(this.table.status, "settled"), lt(this.table.updatedAt, olderThan))),
      orderBy: asc(this.table.updatedAt),
      limit
    });

    return this.toOutputList(items);
  }

  /** Records the dseq of the deployment funded by this payment (pay-per-deploy success). */
  async linkDeployment(id: X402TransactionOutput["id"], deploymentDseq: string): Promise<void> {
    await this.updateById(id, { deploymentDseq });
  }

  /**
   * Flags a paid-and-credited transaction whose deployment creation failed. Funds stay credited to
   * the user's Console balance; the flag + note record that no deployment was produced.
   */
  async markDeployFailed(id: X402TransactionOutput["id"], errorMessage: string): Promise<void> {
    await this.updateById(id, { deployFailed: true, errorMessage });
  }

  /**
   * Count of a user's non-failed x402 transactions created since `since` — the per-window request
   * count the rate limit is enforced against.
   */
  async countByUserSince(userId: X402TransactionOutput["userId"], since: Date): Promise<number> {
    const [row] = await this.cursor
      .select({ count: sql<number>`count(*)::int` })
      .from(this.table)
      .where(and(eq(this.table.userId, userId), gte(this.table.createdAt, since), ne(this.table.status, "failed")));

    return row?.count ?? 0;
  }

  /**
   * Sum (in cents) of a user's non-failed x402 transaction amounts created since `since` — the spend
   * the per-window cost ceiling is enforced against.
   */
  async sumAmountByUserSince(userId: X402TransactionOutput["userId"], since: Date): Promise<number> {
    const [row] = await this.cursor
      .select({ total: sql<number>`coalesce(sum(${this.table.amount}), 0)::int` })
      .from(this.table)
      .where(and(eq(this.table.userId, userId), gte(this.table.createdAt, since), ne(this.table.status, "failed")));

    return row?.total ?? 0;
  }
}
