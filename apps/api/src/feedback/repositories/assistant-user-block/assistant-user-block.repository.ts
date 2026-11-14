import { and, eq, gt, isNull, or } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["AssistantUserBlocks"];
export type AssistantUserBlockOutput = Table["$inferSelect"];

@singleton()
export class AssistantUserBlockRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("AssistantUserBlocks") private readonly table: Table,
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  /** Reads the rows on every call, so an admin's lift or permanent block applies to the very next message. */
  async isBlocked(userId: string, at: Date): Promise<boolean> {
    const [block] = await this.#cursor
      .select({ id: this.table.id })
      .from(this.table)
      .where(and(eq(this.table.userId, userId), isNull(this.table.liftedAt), or(isNull(this.table.blockedUntil), gt(this.table.blockedUntil, at))))
      .limit(1);

    return !!block;
  }

  /** Answers nothing when that day's automatic block already exists, so turns flagged at the same time never block twice. */
  async createAutomatic(input: { userId: string; blockedUntil: Date; flaggedTurnCount: number }): Promise<AssistantUserBlockOutput | undefined> {
    const [block] = await this.#cursor
      .insert(this.table)
      .values({ ...input, source: "automatic" })
      .onConflictDoNothing()
      .returning();

    return block;
  }

  async findById(id: string): Promise<AssistantUserBlockOutput | undefined> {
    const [block] = await this.#cursor.select().from(this.table).where(eq(this.table.id, id));

    return block;
  }
}
