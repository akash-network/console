import type { CreateLogger } from "@src/core";
import { redactSecrets } from "@src/feedback/lib/redact-secrets/redact-secrets";
import {
  type AssistantTurnOutcome,
  MAX_TRACED_PAGE_LENGTH,
  type TracedCard,
  type TracedToolCall
} from "@src/feedback/model-schemas/assistant-turn-trace/assistant-turn-trace.schema";
import type { AssistantTurnTraceInput, AssistantTurnTraceResult } from "@src/feedback/repositories/assistant-turn-trace/assistant-turn-trace.repository";
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

export type FinishedAssistantTurnTrace = AssistantTurnTraceInput & AssistantTurnTraceResult & { cards: TracedCard[] };

export class AssistantTurnTraceBuilder {
  readonly #start: AssistantTurnTraceStart;
  #firstTokenMs: number | null = null;
  #promptTokens = 0;
  #completionTokens = 0;
  readonly #toolCalls: TracedToolCall[] = [];
  readonly #cards: TracedCard[] = [];

  constructor(start: AssistantTurnTraceStart) {
    this.#start = { ...start, page: start.page === null ? null : redactSecrets(start.page).slice(0, MAX_TRACED_PAGE_LENGTH) };
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

  running(): FinishedAssistantTurnTrace {
    return {
      ...this.#start,
      outcome: "running",
      firstTokenMs: null,
      durationMs: 0,
      promptTokens: 0,
      completionTokens: 0,
      toolCalls: [],
      cards: []
    };
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

export function traceResultOf(trace: FinishedAssistantTurnTrace): AssistantTurnTraceResult {
  return {
    outcome: trace.outcome,
    firstTokenMs: trace.firstTokenMs,
    durationMs: trace.durationMs,
    promptTokens: trace.promptTokens,
    completionTokens: trace.completionTokens,
    toolCalls: trace.toolCalls
  };
}

/** Tracing must never fail or change the user's turn, so a failed trace write is only logged. */
export async function writeTraceQuietly<T>(logger: ReturnType<CreateLogger>, write: () => Promise<T>): Promise<T | undefined> {
  try {
    return await write();
  } catch (error) {
    logger.warn({ event: "ASSISTANT_TURN_TRACE_FAILED", error });
    return undefined;
  }
}
