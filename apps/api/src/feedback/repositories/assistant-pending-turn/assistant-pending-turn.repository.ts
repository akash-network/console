import { and, eq, gt, lte, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["AssistantPendingTurns"];
export type AssistantPendingTurnInput = Table["$inferInsert"];
export type AssistantPendingTurnOutput = Table["$inferSelect"];

@singleton()
export class AssistantPendingTurnRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("AssistantPendingTurns") private readonly table: Table,
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  /** A conversation pauses on one turn at a time, so a newer pause replaces the older one. */
  async hold(turn: AssistantPendingTurnInput): Promise<void> {
    await this.#cursor
      .insert(this.table)
      .values(turn)
      .onConflictDoUpdate({
        target: this.table.conversationId,
        set: { state: sql`excluded.state`, expiresAt: sql`excluded.expires_at`, createdAt: sql`now()` },
        setWhere: eq(this.table.userId, turn.userId)
      });
  }

  /** Removes the turn as it reads it, so one answer resumes it at most once. */
  async take(conversationId: string, userId: string, now: Date): Promise<AssistantPendingTurnOutput | undefined> {
    const [turn] = await this.#cursor
      .delete(this.table)
      .where(and(eq(this.table.conversationId, conversationId), eq(this.table.userId, userId), gt(this.table.expiresAt, now)))
      .returning();

    return turn;
  }

  async release(conversationId: string, userId: string): Promise<void> {
    await this.#cursor.delete(this.table).where(and(eq(this.table.conversationId, conversationId), eq(this.table.userId, userId)));
  }

  async deleteExpired(now: Date): Promise<number> {
    const deleted = await this.#cursor.delete(this.table).where(lte(this.table.expiresAt, now)).returning({ conversationId: this.table.conversationId });

    return deleted.length;
  }
}
