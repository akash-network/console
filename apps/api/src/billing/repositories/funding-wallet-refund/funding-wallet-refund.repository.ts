import { and, asc, eq, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

type FundingWalletRefundsTable = ApiPgTables["FundingWalletRefunds"];

export type FundingWalletRefundOutput = FundingWalletRefundsTable["$inferSelect"];

export type FundingWalletRefundStatus = FundingWalletRefundOutput["status"];

export type ReturnedEscrow = Pick<FundingWalletRefundOutput, "moveId" | "txHash" | "msgIndex" | "amount">;

export type FundingWalletRefundPatch = Partial<Pick<FundingWalletRefundOutput, "status" | "failure">>;

@singleton()
export class FundingWalletRefundRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("FundingWalletRefunds") private readonly table: FundingWalletRefundsTable,
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  /** Leaves a close message that is already recorded as it is, since its row is what tells whether it was credited. */
  async recordUnlessKnown(returned: ReturnedEscrow): Promise<void> {
    await this.#cursor
      .insert(this.table)
      .values({ ...returned, status: "pending" })
      .onConflictDoNothing();
  }

  async findByMove(moveId: FundingWalletRefundOutput["moveId"]): Promise<FundingWalletRefundOutput[]> {
    return await this.#cursor.select().from(this.table).where(eq(this.table.moveId, moveId)).orderBy(asc(this.table.createdAt), asc(this.table.id));
  }

  /** Changes a refund only while it is still in the state the caller last saw, so two runs can never both credit it. */
  async updateFrom(
    id: FundingWalletRefundOutput["id"],
    status: FundingWalletRefundStatus,
    patch: FundingWalletRefundPatch
  ): Promise<FundingWalletRefundOutput | undefined> {
    const [refund] = await this.#cursor
      .update(this.table)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(this.table.id, id), eq(this.table.status, status)))
      .returning();

    return refund;
  }
}
