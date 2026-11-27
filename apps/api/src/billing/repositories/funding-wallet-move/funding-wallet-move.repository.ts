import { and, eq, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

type FundingWalletMovesTable = ApiPgTables["FundingWalletMoves"];

export type FundingWalletMoveOutput = FundingWalletMovesTable["$inferSelect"];

export type FundingWalletMoveStatus = FundingWalletMoveOutput["status"];

export type FundingWalletMoveInput = Pick<
  FundingWalletMovesTable["$inferInsert"],
  "userWalletId" | "network" | "fromFundingWalletId" | "toFundingWalletId" | "status" | "readLimit" | "readHeight" | "feeLimit" | "feeExpiresAt"
>;

export type FundingWalletMoveSource = Pick<FundingWalletMoveOutput, "userWalletId" | "network" | "fromFundingWalletId">;

export type FundingWalletMovePatch = Partial<Pick<FundingWalletMoveOutput, "status" | "revokeSentAt" | "revokeTxHash" | "failure">>;

@singleton()
export class FundingWalletMoveRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("FundingWalletMoves") private readonly table: FundingWalletMovesTable,
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  async findBySource({ userWalletId, network, fromFundingWalletId }: FundingWalletMoveSource): Promise<FundingWalletMoveOutput | undefined> {
    const [move] = await this.#cursor
      .select()
      .from(this.table)
      .where(and(eq(this.table.userWalletId, userWalletId), eq(this.table.network, network), eq(this.table.fromFundingWalletId, fromFundingWalletId)));

    return move;
  }

  /** Returns the move that already exists for this user wallet and source wallet rather than a second one, since its saved read is the balance being moved. */
  async createUnlessStarted(input: FundingWalletMoveInput): Promise<FundingWalletMoveOutput> {
    const [created] = await this.#cursor.insert(this.table).values(input).onConflictDoNothing().returning();

    return created ?? (await this.findBySource(input))!;
  }

  async update(id: FundingWalletMoveOutput["id"], patch: FundingWalletMovePatch): Promise<FundingWalletMoveOutput> {
    const [move] = await this.#cursor
      .update(this.table)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(eq(this.table.id, id))
      .returning();

    return move;
  }

  async countByStatus(fromFundingWalletId: string): Promise<Partial<Record<FundingWalletMoveStatus, number>>> {
    const rows = await this.#cursor
      .select({ status: this.table.status, count: sql<number>`count(*)::int` })
      .from(this.table)
      .where(eq(this.table.fromFundingWalletId, fromFundingWalletId))
      .groupBy(this.table.status);

    return Object.fromEntries(rows.map(({ status, count }) => [status, count]));
  }
}
