import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

type FundingWalletMovesTable = ApiPgTables["FundingWalletMoves"];

type FundingWalletsTable = ApiPgTables["FundingWallets"];

export type FundingWalletMoveOutput = FundingWalletMovesTable["$inferSelect"];

export type FundingWalletMoveStatus = FundingWalletMoveOutput["status"];

export type ClaimedFundingWalletMove = FundingWalletMoveOutput & { claimedUntil: Date };

export type CompletedFundingWalletMove = FundingWalletMoveOutput & { fromAddress: string };

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
    @InjectPgTable("FundingWallets") private readonly fundingWallets: FundingWalletsTable,
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

  /** With the address of the funding wallet each move left, whatever state that wallet is in by now. */
  async findCompletedOf(userWalletId: number, network: string): Promise<CompletedFundingWalletMove[]> {
    const rows = await this.#cursor
      .select({ move: this.table, fromAddress: this.fundingWallets.address })
      .from(this.table)
      .innerJoin(this.fundingWallets, eq(this.fundingWallets.id, this.table.fromFundingWalletId))
      .where(and(eq(this.table.userWalletId, userWalletId), eq(this.table.network, network), eq(this.table.status, "completed")))
      .orderBy(asc(this.table.createdAt));

    return rows.map(({ move, fromAddress }) => ({ ...move, fromAddress }));
  }

  async findCompletedUserWalletIds(fromFundingWalletId: string): Promise<number[]> {
    const rows = await this.#cursor
      .select({ userWalletId: this.table.userWalletId })
      .from(this.table)
      .where(and(eq(this.table.fromFundingWalletId, fromFundingWalletId), eq(this.table.status, "completed")))
      .orderBy(asc(this.table.userWalletId));

    return rows.map(({ userWalletId }) => userWalletId);
  }

  /** Returns the move that already exists for this user wallet and source wallet rather than a second one, since its saved read is the balance being moved. */
  async createUnlessStarted(input: FundingWalletMoveInput): Promise<FundingWalletMoveOutput> {
    const [created] = await this.#cursor.insert(this.table).values(input).onConflictDoNothing().returning();

    return created ?? (await this.findBySource(input))!;
  }

  /** Changes a move only while it is still in the state the caller last saw, so two runs can never both take the same step. */
  async updateFrom(
    id: FundingWalletMoveOutput["id"],
    status: FundingWalletMoveStatus,
    patch: FundingWalletMovePatch
  ): Promise<FundingWalletMoveOutput | undefined> {
    const [move] = await this.#cursor
      .update(this.table)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(this.table.id, id), eq(this.table.status, status)))
      .returning();

    return move;
  }

  /** Gives a move to one run at a time; the claim lapses on its own, so a run that died holding it delays the next one instead of blocking it. Its end is kept to the millisecond, since that value is what a release is matched on. */
  async claim(id: FundingWalletMoveOutput["id"], seconds: number): Promise<ClaimedFundingWalletMove | undefined> {
    const [move] = await this.#cursor
      .update(this.table)
      .set({ claimedUntil: sql`date_trunc('milliseconds', now()) + make_interval(secs => ${seconds})` })
      .where(and(eq(this.table.id, id), or(isNull(this.table.claimedUntil), lt(this.table.claimedUntil, sql`now()`))))
      .returning();

    return move?.claimedUntil ? { ...move, claimedUntil: move.claimedUntil } : undefined;
  }

  /** Ends only the claim it is given, so a run that outlived its own claim cannot free the one another run took since. */
  async release(id: FundingWalletMoveOutput["id"], claimedUntil: Date): Promise<void> {
    await this.#cursor
      .update(this.table)
      .set({ claimedUntil: null })
      .where(and(eq(this.table.id, id), eq(this.table.claimedUntil, claimedUntil)));
  }

  async countByStatus(fromFundingWalletId: string): Promise<Partial<Record<FundingWalletMoveStatus, number>>> {
    const rows = await this.#cursor
      .select({ status: this.table.status, count: sql<number>`count(*)::int` })
      .from(this.table)
      .where(eq(this.table.fromFundingWalletId, fromFundingWalletId))
      .groupBy(this.table.status);

    return Object.fromEntries(rows.map(({ status, count }) => [status, count]));
  }

  async findUserWalletIdsByStatus(fromFundingWalletId: string, statuses: FundingWalletMoveStatus[]): Promise<number[]> {
    const rows = await this.#cursor
      .select({ userWalletId: this.table.userWalletId })
      .from(this.table)
      .where(and(eq(this.table.fromFundingWalletId, fromFundingWalletId), inArray(this.table.status, statuses)));

    return rows.map(({ userWalletId }) => userWalletId);
  }
}
