import type { CreateLogger } from "@src/core";
import type { AssistantTurnOutcome, TracedCard, TracedToolCall } from "@src/feedback/model-schemas/assistant-turn-trace/assistant-turn-trace.schema";
import type { AssistantTurnTraceInput } from "@src/feedback/repositories/assistant-turn-trace/assistant-turn-trace.repository";
import type { ChatCompletion } from "@src/feedback/services/akashml-client/akashml.client";

export interface AssistantTurnTraceStart {
  conversationId: string;
  userId: string;
  organizationId: string | null;
  page: string | null;
  model: string;
  promptVersion: string;
  startedAt: Date;
}

export type FinishedAssistantTurnTrace = AssistantTurnTraceInput & { firstTokenMs: number | null; toolCalls: TracedToolCall[] };

export class AssistantTurnTraceBuilder {
  readonly #start: AssistantTurnTraceStart;
  #firstTokenMs: number | null = null;
  #promptTokens = 0;
  #completionTokens = 0;
  readonly #toolCalls: TracedToolCall[] = [];
  readonly #cards: TracedCard[] = [];

  constructor(start: AssistantTurnTraceStart) {
    this.#start = start;
  }

  textShown(at: Date): void {
    this.#firstTokenMs ??= this.#msSinceStart(at);
  }

  usageAdded(usage: ChatCompletion["usage"]): void {
    if (!usage) {
      return;
    }

    this.#promptTokens += usage.promptTokens;
    this.#completionTokens += usage.completionTokens;
  }

  toolFinished(call: TracedToolCall): void {
    this.#toolCalls.push({ name: call.name, ok: call.ok, durationMs: call.durationMs });
  }

  cardProposed(card: { proposalId: string; actionType: string }): void {
    this.#cards.push({ proposalId: card.proposalId, actionType: card.actionType, decision: null });
  }

  finish(outcome: AssistantTurnOutcome, at: Date): FinishedAssistantTurnTrace {
    return {
      ...this.#start,
      outcome,
      firstTokenMs: this.#firstTokenMs,
      durationMs: this.#msSinceStart(at),
      promptTokens: this.#promptTokens,
      completionTokens: this.#completionTokens,
      toolCalls: [...this.#toolCalls],
      cards: [...this.#cards]
    };
  }

  #msSinceStart(at: Date): number {
    return at.getTime() - this.#start.startedAt.getTime();
  }
}

/** Tracing must never fail or change the user's turn, so a failed trace write is only logged. */
export async function writeTraceQuietly(logger: ReturnType<CreateLogger>, write: () => Promise<unknown>): Promise<void> {
  try {
    await write();
  } catch (error) {
    logger.warn({ event: "ASSISTANT_TURN_TRACE_FAILED", error });
  }
}
