import { and, eq, lt, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["AssistantTurnTraces"];
export type AssistantTurnTraceInput = Table["$inferInsert"];

@singleton()
export class AssistantTurnTraceRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("AssistantTurnTraces") private readonly table: Table,
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  async create(input: AssistantTurnTraceInput): Promise<void> {
    await this.#cursor.insert(this.table).values(input);
  }

  async recordCardDecision(input: { userId: string; conversationId: string; proposalId: string; decision: string }): Promise<boolean> {
    const [trace] = await this.#cursor
      .select({ id: this.table.id, cards: this.table.cards })
      .from(this.table)
      .where(
        and(
          eq(this.table.userId, input.userId),
          eq(this.table.conversationId, input.conversationId),
          sql`${this.table.cards} @> ${JSON.stringify([{ proposalId: input.proposalId }])}::jsonb`
        )
      )
      .limit(1);

    if (!trace) {
      return false;
    }

    const cards = trace.cards.map(card => (card.proposalId === input.proposalId ? { ...card, decision: input.decision } : card));
    const updated = await this.#cursor.update(this.table).set({ cards }).where(eq(this.table.id, trace.id)).returning({ id: this.table.id });

    return updated.length > 0;
  }

  async deleteStartedBefore(cutoff: Date): Promise<number> {
    const deleted = await this.#cursor.delete(this.table).where(lt(this.table.startedAt, cutoff)).returning({ id: this.table.id });

    return deleted.length;
  }

  async deleteAllOf(userId: string): Promise<number> {
    const deleted = await this.#cursor.delete(this.table).where(eq(this.table.userId, userId)).returning({ id: this.table.id });

    return deleted.length;
  }
}
