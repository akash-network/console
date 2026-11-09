import { isHttpError } from "http-errors";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { type AssistantStreamEvent, MAX_CLIENT_TOOL_RESULT_LENGTH } from "@src/feedback/http-schemas/assistant-conversation.schema";
import { fallbackAnswerOf } from "@src/feedback/lib/assistant-fallback-answer/assistant-fallback-answer";
import { ASSISTANT_PROMPT_VERSION } from "@src/feedback/lib/assistant-prompt-version/assistant-prompt-version";
import { isLiveHelpToolName, isReadToolName } from "@src/feedback/lib/assistant-tools/assistant-tools";
import { earlierResultOf, toolCallKeyOf } from "@src/feedback/lib/assistant-turn-tool-calls/assistant-turn-tool-calls";
import { AssistantTurnTraceBuilder } from "@src/feedback/lib/assistant-turn-trace/assistant-turn-trace";
import type { AssistantTurnOutcome } from "@src/feedback/model-schemas/assistant-turn-trace/assistant-turn-trace.schema";
import { FEEDBACK_CONFIG, type FeedbackConfig } from "@src/feedback/providers/config.provider";
import { AssistantPendingTurnRepository } from "@src/feedback/repositories/assistant-pending-turn/assistant-pending-turn.repository";
import { AssistantTurnTraceRepository } from "@src/feedback/repositories/assistant-turn-trace/assistant-turn-trace.repository";
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
import type { ProposalContext } from "@src/feedback/services/assistant-proposal/assistant-proposal.service";
import { AssistantToolRunnerService, toolContentOf, type ToolOutcome } from "@src/feedback/services/assistant-tool-runner/assistant-tool-runner.service";
import { AssistantTranscriptService, type TranscriptEntry } from "@src/feedback/services/assistant-transcript/assistant-transcript.service";

export const MAX_TOOL_ROUNDS = 6;
/** Reasoning models spend part of this thinking before they write, so it has to leave room for a whole answer or SDL after that. */
export const MAX_COMPLETION_TOKENS = 8_000;
export const TURN_TIMEOUT_MS = 90_000;
export const PENDING_TURN_TTL_MS = 5 * 60_000;
/** Bounds the burst one round sends to the chain, the provider-proxy and bid screening, since the model can ask for any number of reads at once. */
export const MAX_PARALLEL_READS = 4;

const LIVE_HELP_SUMMARY = "Suggested live help on Discord";
const ROUND_TEXT_SEPARATOR = "\n\n";
const ALREADY_READ_NOTE = "Already read this turn, so this is the earlier result. Answer from it instead of calling the tool again.";

export const LAST_TOOL_ROUND_NOTE: ChatMessage = {
  role: "system",
  content: "This is your last tool round. After it you must answer the user with what you found."
};

export const ANSWER_NOW_NOTE: ChatMessage = {
  role: "system",
  content:
    "No more tools. Answer the user now in a few sentences: what you found in the data you read, the likely cause, and one concrete next step. Do not stay silent."
};

export type EmitAssistantEvent = (event: AssistantStreamEvent) => Promise<void>;

type TimedToolOutcome = { outcome: ToolOutcome; durationMs: number };

type TurnEnding = { outcome: AssistantTurnOutcome; finishReason: ChatCompletion["finishReason"] };

function textDeltaEmitter(emit: EmitAssistantEvent, followsEarlierRoundText: boolean): (text: string) => Promise<void> {
  let separator = followsEarlierRoundText ? ROUND_TEXT_SEPARATOR : "";

  return text => {
    const delta = separator + text;
    separator = "";
    return emit({ type: "text_delta", text: delta });
  };
}

function trackingShownText(emit: EmitAssistantEvent): { emit: EmitAssistantEvent; shownText: () => string } {
  const shown: string[] = [];

  return {
    emit: event => {
      if (event.type === "text_delta") shown.push(event.text);
      return emit(event);
    },
    shownText: () => shown.join("")
  };
}

export function alreadyReadContentOf(tool: string, earlierResult: string): string {
  try {
    return toolContentOf(tool, { data: { note: ALREADY_READ_NOTE, earlierResult: JSON.parse(earlierResult) } });
  } catch {
    return toolContentOf(tool, { data: { note: ALREADY_READ_NOTE, earlierResult } });
  }
}

export interface AssistantTurn {
  conversationId: string;
  userId: string;
  organizationId: string | null;
  page: string | null;
  stored: boolean;
  isTrialing: boolean | null;
  configureFormOpen: boolean;
  messages: ChatMessage[];
  roundsUsed: number;
}

function hasText(content: string | null): content is string {
  return !!content?.trim();
}

/** The rounds that still offer tools end with a note, so the model knows when it must answer instead of reading more. */
export function requestMessagesFor(messages: ChatMessage[], round: number): ChatMessage[] {
  if (round >= MAX_TOOL_ROUNDS) return [...messages, ANSWER_NOW_NOTE];
  if (round === MAX_TOOL_ROUNDS - 1) return [...messages, LAST_TOOL_ROUND_NOTE];

  return messages;
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
    private readonly traceRepository: AssistantTurnTraceRepository,
    @inject(FEEDBACK_CONFIG) private readonly config: FeedbackConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AssistantTurnService.name });
  }

  async run(turn: AssistantTurn, emitEvent: EmitAssistantEvent, signal: AbortSignal): Promise<void> {
    const trace = this.#startTrace(turn);
    let outcome: AssistantTurnOutcome = "failed";

    try {
      outcome = await this.#runTurn(turn, trace, emitEvent, signal);
    } finally {
      await this.#finishTrace(trace, outcome);
    }
  }

  async #runTurn(turn: AssistantTurn, trace: AssistantTurnTraceBuilder, emitEvent: EmitAssistantEvent, signal: AbortSignal): Promise<AssistantTurnOutcome> {
    const { emit, shownText } = trackingShownText(emitEvent);
    const deadline = AbortSignal.timeout(TURN_TIMEOUT_MS);
    const abort = AbortSignal.any([signal, deadline]);
    const messages = [...turn.messages];
    const answer: string[] = [];
    const proposalContext: ProposalContext = { isTrialing: turn.isTrialing, configureFormOpen: turn.configureFormOpen, withheldTemplateSdls: [] };
    let round = turn.roundsUsed;

    try {
      for (; ; round++) {
        const isFinalRound = round >= MAX_TOOL_ROUNDS;
        const completion = await this.#complete(
          requestMessagesFor(messages, round),
          { isFinalRound, configureFormOpen: turn.configureFormOpen },
          abort,
          trace,
          textDeltaEmitter(emit, answer.length > 0)
        );
        if (completion.content) answer.push(completion.content);

        if (isFinalRound || completion.toolCalls.length === 0) {
          const ending: TurnEnding = hasText(completion.content)
            ? { outcome: "answered", finishReason: completion.finishReason }
            : await this.#answerNow(turn, messages, answer, abort, trace, emit);
          await this.#recordAnswer(turn, answer);
          await emit({ type: "done", reason: ending.finishReason === "length" ? "length" : "stop" });
          return ending.outcome;
        }

        messages.push({ role: "assistant", content: completion.content, tool_calls: completion.toolCalls });
        const clientToolCalls = await this.#runTools(turn, proposalContext, completion.toolCalls, messages, trace, emit);

        if (clientToolCalls.length > 0) {
          await this.#pause(turn, messages, clientToolCalls, round + 1);
          await this.#recordAnswer(turn, answer);
          await emit({ type: "done", reason: "awaiting_client_tool" });
          return "awaiting_browser";
        }
      }
    } catch (error) {
      if (signal.aborted) return "cancelled";
      if (deadline.aborted) return await this.#endTimedOutTurn(turn, messages, shownText(), round, emit);

      return await this.#endFailedTurn(error, emit);
    }
  }

  #startTrace(turn: AssistantTurn): AssistantTurnTraceBuilder {
    return new AssistantTurnTraceBuilder({
      conversationId: turn.conversationId,
      userId: turn.userId,
      organizationId: turn.organizationId,
      page: turn.page,
      model: this.config.ASSISTANT_MODEL,
      promptVersion: ASSISTANT_PROMPT_VERSION,
      startedAt: new Date()
    });
  }

  /** Runs after the turn's last event and swallows its own errors, so tracing never delays, fails or changes what the user sees. */
  async #finishTrace(trace: AssistantTurnTraceBuilder, outcome: AssistantTurnOutcome): Promise<void> {
    try {
      const finished = trace.finish(outcome, new Date());
      this.#logger.info({
        event: "ASSISTANT_TURN_COMPLETED",
        outcome,
        durationMs: finished.durationMs,
        firstTokenMs: finished.firstTokenMs,
        model: finished.model,
        promptVersion: finished.promptVersion,
        toolCallCount: finished.toolCalls.length,
        failedToolCallCount: finished.toolCalls.filter(({ ok }) => !ok).length
      });
      await this.traceRepository.create(finished);
    } catch (error) {
      this.#logger.warn({ event: "ASSISTANT_TURN_TRACE_FAILED", error });
    }
  }

  /** A turn that runs out of time still answers with what it read, since an error would hide reads the user already saw as chips. */
  async #endTimedOutTurn(
    turn: AssistantTurn,
    messages: ChatMessage[],
    shownText: string,
    round: number,
    emit: EmitAssistantEvent
  ): Promise<AssistantTurnOutcome> {
    this.#logger.warn({ event: "ASSISTANT_TURN_TIMED_OUT", round, timeoutMs: TURN_TIMEOUT_MS });
    const fallback = fallbackAnswerOf(messages);
    await textDeltaEmitter(emit, shownText.length > 0)(fallback);
    await this.#recordAnswer(turn, shownText ? [shownText, fallback] : [fallback]);
    await emit({ type: "done", reason: "stop" });
    return "timed_out";
  }

  async #complete(
    messages: ChatMessage[],
    { isFinalRound, configureFormOpen }: { isFinalRound: boolean; configureFormOpen: boolean },
    signal: AbortSignal,
    trace: AssistantTurnTraceBuilder,
    onContentDelta: (text: string) => Promise<void>
  ): Promise<ChatCompletion> {
    await this.limitsService.assertWithinBudget();

    const completion = await this.akashMlClient.streamChatCompletion(
      {
        model: this.config.ASSISTANT_MODEL,
        messages,
        tools: await this.toolRunner.chatTools({ configureFormOpen }),
        tool_choice: isFinalRound ? "none" : "auto",
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        reasoning_effort: this.config.ASSISTANT_REASONING_EFFORT
      },
      {
        signal,
        onContentDelta: text => {
          trace.textShown(new Date());
          return onContentDelta(text);
        }
      }
    );
    trace.usageAdded(completion.usage);
    await this.limitsService.recordUsage(completion.usage);

    return completion;
  }

  /** A turn never ends silently: an empty last completion gets one tools-free retry, then a fixed answer naming what was read. */
  async #answerNow(
    turn: AssistantTurn,
    messages: ChatMessage[],
    answer: string[],
    signal: AbortSignal,
    trace: AssistantTurnTraceBuilder,
    emit: EmitAssistantEvent
  ): Promise<TurnEnding> {
    const completion = await this.#complete(
      [...messages, ANSWER_NOW_NOTE],
      { isFinalRound: true, configureFormOpen: turn.configureFormOpen },
      signal,
      trace,
      textDeltaEmitter(emit, answer.length > 0)
    );
    if (completion.content) answer.push(completion.content);
    this.#logger.info({ event: "ASSISTANT_EMPTY_ANSWER_RECOVERED", recoveredBy: hasText(completion.content) ? "answer_now" : "fallback" });
    if (hasText(completion.content)) return { outcome: "recovered", finishReason: completion.finishReason };

    const fallback = fallbackAnswerOf(messages);
    await textDeltaEmitter(emit, answer.length > 0)(fallback);
    answer.push(fallback);
    return { outcome: "fallback", finishReason: "stop" };
  }

  async #runTools(
    turn: AssistantTurn,
    proposalContext: ProposalContext,
    toolCalls: ChatToolCall[],
    messages: ChatMessage[],
    trace: AssistantTurnTraceBuilder,
    emit: EmitAssistantEvent
  ): Promise<ChatToolCall[]> {
    const clientToolCalls: ChatToolCall[] = [];
    const startedReads = await this.#startLeadingReads(toolCalls, messages, proposalContext, emit);

    for (const call of toolCalls) {
      const name = call.function.name;
      const earlierResult = earlierResultOf(call, messages);
      if (earlierResult !== undefined) {
        messages.push({ role: "tool", tool_call_id: call.id, content: alreadyReadContentOf(name, earlierResult) });
        continue;
      }

      const showsAsRead = !isLiveHelpToolName(name);
      const startedRead = startedReads.get(call.id);
      if (showsAsRead && !startedRead) await emit({ type: "tool_started", toolCallId: call.id, name });
      const { outcome, durationMs } = await (startedRead ?? this.#timedRun(call, proposalContext));

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

      trace.toolFinished({ name, ok: outcome.ok, durationMs });
      if (outcome.kind === "proposal") {
        trace.cardProposed({ proposalId: outcome.proposalId, actionType: outcome.action.type });
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

  /** Only reads ahead of the round's first card or browser tool run at once, since a card can change what a later call in the round sees. */
  async #startLeadingReads(
    toolCalls: ChatToolCall[],
    messages: ChatMessage[],
    proposalContext: ProposalContext,
    emit: EmitAssistantEvent
  ): Promise<Map<string, Promise<TimedToolOutcome>>> {
    const started = new Map<string, Promise<TimedToolOutcome>>();
    const startedKeys = new Set<string>();

    for (const call of toolCalls) {
      if (!isReadToolName(call.function.name) || started.size >= MAX_PARALLEL_READS) break;

      const key = toolCallKeyOf(call);
      if (startedKeys.has(key) || earlierResultOf(call, messages) !== undefined) continue;

      startedKeys.add(key);
      await emit({ type: "tool_started", toolCallId: call.id, name: call.function.name });
      started.set(call.id, this.#timedRun(call, proposalContext));
    }

    return started;
  }

  async #timedRun(call: ChatToolCall, proposalContext: ProposalContext): Promise<TimedToolOutcome> {
    const startedAt = Date.now();
    const outcome = await this.toolRunner.run(call, proposalContext);

    return { outcome, durationMs: Date.now() - startedAt };
  }

  async #pause(turn: AssistantTurn, messages: ChatMessage[], clientToolCalls: ChatToolCall[], roundsUsed: number): Promise<void> {
    await this.pendingTurnRepository.hold({
      conversationId: turn.conversationId,
      userId: turn.userId,
      state: {
        messages,
        clientToolCalls,
        roundsUsed,
        stored: turn.stored,
        isTrialing: turn.isTrialing,
        configureFormOpen: turn.configureFormOpen,
        organizationId: turn.organizationId,
        page: turn.page
      },
      expiresAt: new Date(Date.now() + PENDING_TURN_TTL_MS)
    });
  }

  async #recordAnswer(turn: AssistantTurn, answer: string[]): Promise<void> {
    if (answer.length === 0) return;

    await this.#record(turn, { role: "assistant", content: answer.join(ROUND_TEXT_SEPARATOR) });
  }

  async #record(turn: AssistantTurn, entry: TranscriptEntry): Promise<void> {
    if (!turn.stored) return;

    await this.transcriptService.record(turn.conversationId, entry);
  }

  async #endFailedTurn(error: unknown, emit: EmitAssistantEvent): Promise<AssistantTurnOutcome> {
    if (isModelFailure(error)) {
      this.#logger.warn({ event: "ASSISTANT_MODEL_FAILED", error });
      await emit({ type: "error", code: "assistant_unavailable", message: "The assistant is unavailable right now. Ask on Discord for live help." });
      return "model_failed";
    }

    this.#logger.error({ event: "ASSISTANT_TURN_FAILED", error });
    await emit({ type: "error", code: "assistant_error", message: "Something went wrong. Try again, or ask on Discord." });
    return "failed";
  }
}
