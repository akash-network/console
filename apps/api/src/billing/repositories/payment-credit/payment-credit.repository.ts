import { and, eq } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";

type Table = ApiPgTables["PaymentCredits"];

export type PaymentCreditInput = Table["$inferInsert"];
export type PaymentCreditOutput = Table["$inferSelect"];

/** Never joins the caller's transaction, so what it records about a grant on chain survives the rollback of the settlement that made it. */
@singleton()
export class PaymentCreditRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("PaymentCredits") private readonly table: Table
  ) {}

  async findByTransactionId(transactionId: string): Promise<PaymentCreditOutput | undefined> {
    const [credit] = await this.pg.select().from(this.table).where(eq(this.table.transactionId, transactionId));

    return credit;
  }

  async createPending(input: Pick<PaymentCreditInput, "transactionId" | "address" | "amount">): Promise<void> {
    await this.pg.insert(this.table).values({ ...input, status: "pending" });
  }

  async markLanded(transactionId: string, txHash: string | null | undefined): Promise<void> {
    await this.pg
      .update(this.table)
      .set({ status: "landed", ...(txHash && { txHash }) })
      .where(eq(this.table.transactionId, transactionId));
  }

  async attachTxHash(transactionId: string, txHash: string): Promise<void> {
    await this.pg.update(this.table).set({ txHash }).where(eq(this.table.transactionId, transactionId));
  }

  async deletePending(transactionId: string): Promise<void> {
    await this.pg.delete(this.table).where(and(eq(this.table.transactionId, transactionId), eq(this.table.status, "pending")));
  }
}
