import { eq } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["FirstPurchaseBonusWinBacks"];

export type FirstPurchaseBonusWinBack = Pick<Table["$inferSelect"], "userId" | "openedAt" | "closesAt">;

@singleton()
export class FirstPurchaseBonusWinBackRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("FirstPurchaseBonusWinBacks") private readonly table: Table,
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  async findByUserId(userId: string): Promise<FirstPurchaseBonusWinBack | undefined> {
    const [winBack] = await this.#cursor
      .select({ userId: this.table.userId, openedAt: this.table.openedAt, closesAt: this.table.closesAt })
      .from(this.table)
      .where(eq(this.table.userId, userId));

    return winBack;
  }

  /** Answers false when the person already has a row, so a second check never moves a window that already opened. */
  async create(input: FirstPurchaseBonusWinBack): Promise<boolean> {
    const created = await this.#cursor
      .insert(this.table)
      .values(input)
      .onConflictDoNothing({ target: this.table.userId })
      .returning({ userId: this.table.userId });

    return created.length > 0;
  }
}
