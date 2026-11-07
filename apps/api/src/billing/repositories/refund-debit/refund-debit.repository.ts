import { and, eq, gt } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";

type Table = ApiPgTables["RefundDebits"];

export type RefundDebitInput = Table["$inferInsert"];
export type RefundDebitOutput = Table["$inferSelect"];

type RefundDebitKey = Pick<RefundDebitOutput, "transactionId" | "amountRefunded">;

/** Never joins the caller's transaction, so what it records about a debit on chain survives the rollback of the refund that made it. */
@singleton()
export class RefundDebitRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("RefundDebits") private readonly table: Table
  ) {}

  async findRefundedBeyond(transactionId: string, amountRefunded: number): Promise<RefundDebitOutput[]> {
    return await this.pg
      .select()
      .from(this.table)
      .where(and(eq(this.table.transactionId, transactionId), gt(this.table.amountRefunded, amountRefunded)));
  }

  async createPending(input: Pick<RefundDebitInput, "transactionId" | "amountRefunded" | "address" | "amount">): Promise<void> {
    await this.pg.insert(this.table).values({ ...input, status: "pending" });
  }

  async markLanded(key: RefundDebitKey, txHash: string | null | undefined): Promise<void> {
    await this.pg
      .update(this.table)
      .set({ status: "landed", ...(txHash && { txHash }) })
      .where(this.#whereKey(key));
  }

  async attachTxHash(key: RefundDebitKey, txHash: string): Promise<void> {
    await this.pg.update(this.table).set({ txHash }).where(this.#whereKey(key));
  }

  async deletePending(key: RefundDebitKey): Promise<void> {
    await this.pg.delete(this.table).where(and(this.#whereKey(key), eq(this.table.status, "pending")));
  }

  #whereKey({ transactionId, amountRefunded }: RefundDebitKey) {
    return and(eq(this.table.transactionId, transactionId), eq(this.table.amountRefunded, amountRefunded));
  }
}
