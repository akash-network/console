import { isHttpError } from "http-errors";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { type AssistantStreamEvent, MAX_CLIENT_TOOL_RESULT_LENGTH } from "@src/feedback/http-schemas/assistant-conversation.schema";
import { assistantChatTools, isLiveHelpToolName } from "@src/feedback/lib/assistant-tools/assistant-tools";
import { FEEDBACK_CONFIG, type FeedbackConfig } from "@src/feedback/providers/config.provider";
import { AssistantPendingTurnRepository } from "@src/feedback/repositories/assistant-pending-turn/assistant-pending-turn.repository";
import {
  AkashMlClient,
  AkashMlOutputError,
  AkashMlRequestError,
  AkashMlUnavailableError,
  type ChatCompletion,
  type ChatMessage,
  type ChatToolCall
} from "@src/feedback/services/akashml-client/akashml.client";
import { AssistantLimitsService } from "@src/feedback/services/assistant-limits/assistant-limits.service";
import { AssistantToolRunnerService } from "@src/feedback/services/assistant-tool-runner/assistant-tool-runner.service";
import { AssistantTranscriptService, type TranscriptEntry } from "@src/feedback/services/assistant-transcript/assistant-transcript.service";

export const MAX_TOOL_ROUNDS = 6;
export const MAX_COMPLETION_TOKENS = 1_200;
export const TURN_TIMEOUT_MS = 90_000;
export const PENDING_TURN_TTL_MS = 5 * 60_000;

const LIVE_HELP_SUMMARY = "Suggested live help on Discord";

export type EmitAssistantEvent = (event: AssistantStreamEvent) => Promise<void>;

export interface AssistantTurn {
  conversationId: string;
  userId: string;
  stored: boolean;
  isTrialing: boolean | null;
  messages: ChatMessage[];
  roundsUsed: number;
}

function isModelFailure(error: unknown): boolean {
  return (
    error instanceof AkashMlUnavailableError ||
    error instanceof AkashMlRequestError ||
    error instanceof AkashMlOutputError ||
    (isHttpError(error) && error.status === 503)
  );
}

/** Bounds every turn by rounds, tokens per completion and wall time, and leaves every write to a card the user confirms. */
@singleton()
export class AssistantTurnService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly akashMlClient: AkashMlClient,
    private readonly toolRunner: AssistantToolRunnerService,
    private readonly limitsService: AssistantLimitsService,
    private readonly transcriptService: AssistantTranscriptService,
    private readonly pendingTurnRepository: AssistantPendingTurnRepository,
    @inject(FEEDBACK_CONFIG) private readonly config: FeedbackConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AssistantTurnService.name });
  }

  async run(turn: AssistantTurn, emit: EmitAssistantEvent, signal: AbortSignal): Promise<void> {
    const deadline = AbortSignal.timeout(TURN_TIMEOUT_MS);
    const abort = AbortSignal.any([signal, deadline]);
    const messages = [...turn.messages];
    const answer: string[] = [];

    try {
      for (let round = turn.roundsUsed; ; round++) {
        const isFinalRound = round >= MAX_TOOL_ROUNDS;
        const completion = await this.#complete(messages, isFinalRound, abort, emit);
        if (completion.content) answer.push(completion.content);

        if (isFinalRound || completion.toolCalls.length === 0) {
          await this.#recordAnswer(turn, answer);
          await emit({ type: "done", reason: completion.finishReason === "length" ? "length" : "stop" });
          return;
        }

        messages.push({ role: "assistant", content: completion.content, tool_calls: completion.toolCalls });
        const clientToolCalls = await this.#runTools(turn, completion.toolCalls, messages, emit);

        if (clientToolCalls.length > 0) {
          await this.#pause(turn, messages, clientToolCalls, round + 1);
          await this.#recordAnswer(turn, answer);
          await emit({ type: "done", reason: "awaiting_client_tool" });
          return;
        }
      }
    } catch (error) {
      if (signal.aborted) return;

      await emit(this.#errorEventOf(error, deadline.aborted));
    }
  }

  async #complete(messages: ChatMessage[], isFinalRound: boolean, signal: AbortSignal, emit: EmitAssistantEvent): Promise<ChatCompletion> {
    await this.limitsService.assertWithinBudget();

    const completion = await this.akashMlClient.streamChatCompletion(
      {
        model: this.config.ASSISTANT_MODEL,
        messages,
        tools: assistantChatTools(),
        tool_choice: isFinalRound ? "none" : "auto",
        max_completion_tokens: MAX_COMPLETION_TOKENS
      },
      { signal, onContentDelta: text => emit({ type: "text_delta", text }) }
    );
    await this.limitsService.recordUsage(completion.usage);

    return completion;
  }

  async #runTools(turn: AssistantTurn, toolCalls: ChatToolCall[], messages: ChatMessage[], emit: EmitAssistantEvent): Promise<ChatToolCall[]> {
    const clientToolCalls: ChatToolCall[] = [];

    for (const call of toolCalls) {
      const name = call.function.name;
      const showsAsRead = !isLiveHelpToolName(name);
      if (showsAsRead) await emit({ type: "tool_started", toolCallId: call.id, name });
      const outcome = await this.toolRunner.run(call, { isTrialing: turn.isTrialing });

      if (outcome.kind === "client") {
        clientToolCalls.push(call);
        await emit({
          type: "client_tool_request",
          toolCallId: call.id,
          name: outcome.call.name,
          arguments: outcome.call.arguments,
          maxLength: MAX_CLIENT_TOOL_RESULT_LENGTH
        });
        continue;
      }

      messages.push({ role: "tool", tool_call_id: call.id, content: outcome.content });

      if (outcome.kind === "live_help") {
        await emit({ type: "live_help_suggested", reason: outcome.reason });
        await this.#record(turn, { role: "tool", content: LIVE_HELP_SUMMARY, toolName: name, toolPayload: { toolCallId: call.id, reason: outcome.reason } });
        continue;
      }

      if (outcome.kind === "proposal") {
        await emit({
          type: "action_proposal",
          proposalId: outcome.proposalId,
          action: outcome.action,
          ...(outcome.diagnosis && { diagnosis: outcome.diagnosis })
        });
      }

      if (showsAsRead) await emit({ type: "tool_result_summary", toolCallId: call.id, name, ok: outcome.ok, summary: outcome.summary });
      await this.#record(turn, {
        role: "tool",
        content: outcome.summary,
        toolName: name,
        toolPayload:
          outcome.kind === "proposal"
            ? { toolCallId: call.id, proposalId: outcome.proposalId, action: outcome.action, diagnosis: outcome.diagnosis }
            : { toolCallId: call.id, ok: outcome.ok }
      });
    }

    return clientToolCalls;
  }

  async #pause(turn: AssistantTurn, messages: ChatMessage[], clientToolCalls: ChatToolCall[], roundsUsed: number): Promise<void> {
    await this.pendingTurnRepository.hold({
      conversationId: turn.conversationId,
      userId: turn.userId,
      state: { messages, clientToolCalls, roundsUsed, stored: turn.stored, isTrialing: turn.isTrialing },
      expiresAt: new Date(Date.now() + PENDING_TURN_TTL_MS)
    });
  }

  async #recordAnswer(turn: AssistantTurn, answer: string[]): Promise<void> {
    if (answer.length === 0) return;

    await this.#record(turn, { role: "assistant", content: answer.join("\n\n") });
  }

  async #record(turn: AssistantTurn, entry: TranscriptEntry): Promise<void> {
    if (!turn.stored) return;

    await this.transcriptService.record(turn.conversationId, entry);
  }

  #errorEventOf(error: unknown, timedOut: boolean): AssistantStreamEvent {
    if (timedOut) {
      return { type: "error", code: "assistant_timeout", message: "The assistant took too long to answer. Try again, or ask on Discord." };
    }

    if (isModelFailure(error)) {
      this.#logger.warn({ event: "ASSISTANT_MODEL_FAILED", error });
      return { type: "error", code: "assistant_unavailable", message: "The assistant is unavailable right now. Ask on Discord for live help." };
    }

    this.#logger.error({ event: "ASSISTANT_TURN_FAILED", error });
    return { type: "error", code: "assistant_error", message: "Something went wrong. Try again, or ask on Discord." };
  }
}
