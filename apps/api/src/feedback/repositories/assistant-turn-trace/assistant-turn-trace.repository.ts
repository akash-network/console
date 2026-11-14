import { and, eq, lt, type SQL, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";
import type {
  AssistantTurnFlag,
  AssistantTurnOutcome,
  AssistantTurnRating,
  TracedCard
} from "@src/feedback/model-schemas/assistant-turn-trace/assistant-turn-trace.schema";

type Table = ApiPgTables["AssistantTurnTraces"];
export type AssistantTurnTraceInput = Table["$inferInsert"];
export type AssistantTurnTraceResult = Pick<
  Required<AssistantTurnTraceInput>,
  "outcome" | "firstTokenMs" | "durationMs" | "promptTokens" | "completionTokens" | "toolCalls"
>;
export type ReportedTurn = { id: string; outcome: AssistantTurnOutcome; model: string };

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

  async start(input: AssistantTurnTraceInput): Promise<string> {
    const [trace] = await this.#cursor.insert(this.table).values(input).returning({ id: this.table.id });

    return trace.id;
  }

  async appendCard(id: string, card: TracedCard): Promise<void> {
    await this.#cursor
      .update(this.table)
      .set({ cards: sql`${this.table.cards} || ${JSON.stringify([card])}::jsonb` })
      .where(eq(this.table.id, id));
  }

  /** Leaves cards alone, since decisions on them can be recorded while the turn is still streaming. */
  async finish(id: string, result: AssistantTurnTraceResult): Promise<void> {
    await this.#cursor.update(this.table).set(result).where(eq(this.table.id, id));
  }

  async flag(id: string, flag: AssistantTurnFlag): Promise<void> {
    await this.#cursor.update(this.table).set({ flag }).where(eq(this.table.id, id));
  }

  async recordCardDecision(input: { userId: string; conversationId: string; proposalId: string; decision: string }): Promise<boolean> {
    const updated = await this.#cursor
      .update(this.table)
      .set({
        cards: sql`(
          SELECT jsonb_agg(
            CASE WHEN card ->> 'proposalId' = ${input.proposalId} THEN jsonb_set(card, '{decision}', to_jsonb(${input.decision}::text)) ELSE card END
            ORDER BY position
          )
          FROM jsonb_array_elements(${this.table.cards}) WITH ORDINALITY AS traced(card, position)
        )`
      })
      .where(
        and(
          eq(this.table.userId, input.userId),
          eq(this.table.conversationId, input.conversationId),
          sql`${this.table.cards} @> ${JSON.stringify([{ proposalId: input.proposalId }])}::jsonb`
        )
      )
      .returning({ id: this.table.id });

    return updated.length > 0;
  }

  async rate(input: { id: string; userId: string; conversationId: string; rating: AssistantTurnRating | null }): Promise<boolean> {
    const rated = await this.#cursor
      .update(this.table)
      .set({ rating: input.rating })
      .where(and(eq(this.table.id, input.id), eq(this.table.userId, input.userId), eq(this.table.conversationId, input.conversationId)))
      .returning({ id: this.table.id });

    return rated.length > 0;
  }

  async findTurnOf(input: { id: string; userId: string; conversationId: string }): Promise<ReportedTurn | undefined> {
    return await this.#findTurnWhere(
      and(eq(this.table.id, input.id), eq(this.table.userId, input.userId), eq(this.table.conversationId, input.conversationId))
    );
  }

  async findTurnById(id: string): Promise<ReportedTurn | undefined> {
    return await this.#findTurnWhere(eq(this.table.id, id));
  }

  async #findTurnWhere(where: SQL | undefined): Promise<ReportedTurn | undefined> {
    const [turn] = await this.#cursor.select({ id: this.table.id, outcome: this.table.outcome, model: this.table.model }).from(this.table).where(where);

    return turn;
  }

  async markAbandoned(startedBefore: Date): Promise<number> {
    const marked = await this.#cursor
      .update(this.table)
      .set({ outcome: "failed" })
      .where(and(eq(this.table.outcome, "running"), lt(this.table.startedAt, startedBefore)))
      .returning({ id: this.table.id });

    return marked.length;
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
