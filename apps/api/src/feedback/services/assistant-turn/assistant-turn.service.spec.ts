import createError from "http-errors";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { envSchema } from "@src/feedback/config/env.config";
import type { AssistantAction } from "@src/feedback/http-schemas/assistant-action.schema";
import type { AssistantStreamEvent } from "@src/feedback/http-schemas/assistant-conversation.schema";
import { assistantChatTools } from "@src/feedback/lib/assistant-tools/assistant-tools";
import type { AssistantPendingTurnRepository } from "@src/feedback/repositories/assistant-pending-turn/assistant-pending-turn.repository";
import {
  type AkashMlClient,
  AkashMlOutputError,
  AkashMlRequestError,
  AkashMlUnavailableError,
  type ChatCompletion,
  type ChatMessage,
  type ChatToolCall
} from "@src/feedback/services/akashml-client/akashml.client";
import type { AssistantLimitsService } from "@src/feedback/services/assistant-limits/assistant-limits.service";
import type { AssistantToolRunnerService } from "@src/feedback/services/assistant-tool-runner/assistant-tool-runner.service";
import type { AssistantTranscriptService } from "@src/feedback/services/assistant-transcript/assistant-transcript.service";
import {
  type AssistantTurn,
  AssistantTurnService,
  MAX_COMPLETION_TOKENS,
  MAX_TOOL_ROUNDS,
  PENDING_TURN_TTL_MS,
  TURN_TIMEOUT_MS
} from "./assistant-turn.service";

const NOW = new Date("2026-11-04T12:00:00.000Z");
const USAGE = { promptTokens: 100, completionTokens: 20 };

function completion(overrides: Partial<ChatCompletion> = {}): ChatCompletion {
  return { content: null, toolCalls: [], finishReason: "stop", usage: USAGE, ...overrides };
}

function streamed(overrides: Partial<ChatCompletion> = {}, deltas = overrides.content ? [overrides.content] : []): AkashMlClient["streamChatCompletion"] {
  return async (_request, { onContentDelta }) => {
    for (const text of deltas) await onContentDelta(text);
    return completion(overrides);
  };
}

function toolCall(id: string, name: string, args: Record<string, unknown> = {}): ChatToolCall {
  return { id, type: "function", function: { name, arguments: JSON.stringify(args) } };
}

describe(AssistantTurnService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("streams a text answer, bounded and budgeted, and stores it for a stored conversation", async () => {
    const { service, akashMlClient, limitsService, transcriptService, run } = setup();
    akashMlClient.streamChatCompletion.mockImplementation(streamed({ content: "Your deployment is live." }));

    const events = await run({ stored: true });

    expect(events).toEqual([
      { type: "text_delta", text: "Your deployment is live." },
      { type: "done", reason: "stop" }
    ]);
    expect(akashMlClient.streamChatCompletion).toHaveBeenCalledWith(
      {
        model: "assistant-model",
        messages: [{ role: "user", content: "hi" }],
        tools: assistantChatTools(),
        tool_choice: "auto",
        max_completion_tokens: MAX_COMPLETION_TOKENS
      },
      { signal: expect.any(AbortSignal), onContentDelta: expect.any(Function) }
    );
    expect(limitsService.assertWithinBudget).toHaveBeenCalledTimes(1);
    expect(limitsService.recordUsage).toHaveBeenCalledWith(USAGE);
    expect(transcriptService.record).toHaveBeenCalledWith("conversation-1", { role: "assistant", content: "Your deployment is live." });
    expect(service).toBeInstanceOf(AssistantTurnService);
  });

  it("emits each piece of the answer as the model streams it, and stores the answer whole", async () => {
    const { akashMlClient, toolRunner, transcriptService, run } = setup();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ content: "Let me check.", toolCalls: [toolCall("c1", "get_deployment", { dseq: "42" })] }, ["Let me ", "check."]))
      .mockImplementationOnce(streamed({ content: "It is running." }, ["It is ", "running."]));
    toolRunner.run.mockResolvedValue({ kind: "result", content: "{}", summary: "Read deployment 42", ok: true });

    const events = await run({ stored: true });

    expect(events).toEqual([
      { type: "text_delta", text: "Let me " },
      { type: "text_delta", text: "check." },
      { type: "tool_started", toolCallId: "c1", name: "get_deployment" },
      { type: "tool_result_summary", toolCallId: "c1", name: "get_deployment", ok: true, summary: "Read deployment 42" },
      { type: "text_delta", text: "\n\nIt is " },
      { type: "text_delta", text: "running." },
      { type: "done", reason: "stop" }
    ]);
    expect(transcriptService.record).toHaveBeenLastCalledWith("conversation-1", { role: "assistant", content: "Let me check.\n\nIt is running." });
  });

  it("separates only rounds that wrote text, so the streamed answer reads the same as the stored one", async () => {
    const { akashMlClient, toolRunner, transcriptService, run } = setup();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", "get_deployment", { dseq: "42" })] }))
      .mockImplementationOnce(streamed({ content: "Let me check.", toolCalls: [toolCall("c2", "get_bids", { dseq: "42" })] }, ["Let me ", "check."]))
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c3", "get_lease", { dseq: "42" })] }))
      .mockImplementationOnce(streamed({ content: "It is running." }, ["It is ", "running."]));
    toolRunner.run.mockResolvedValue({ kind: "result", content: "{}", summary: "Read", ok: true });

    const events = await run({ stored: true });
    const streamedText = events.flatMap(event => (event.type === "text_delta" ? [event.text] : []));

    expect(streamedText).toEqual(["Let me ", "check.", "\n\nIt is ", "running."]);
    expect(transcriptService.record).toHaveBeenLastCalledWith("conversation-1", { role: "assistant", content: streamedText.join("") });
  });

  it("reports a model that fails after streaming part of the answer, and stores no partial answer", async () => {
    const { akashMlClient, logger, transcriptService, run } = setup();
    const error = new AkashMlRequestError("AkashML stream failed: ECONNRESET", undefined);
    akashMlClient.streamChatCompletion.mockImplementation(async (_request, { onContentDelta }) => {
      await onContentDelta("Your dep");
      throw error;
    });

    expect(await run({ stored: true })).toEqual([
      { type: "text_delta", text: "Your dep" },
      { type: "error", code: "assistant_unavailable", message: "The assistant is unavailable right now. Ask on Discord for live help." }
    ]);
    expect(logger.warn).toHaveBeenCalledWith({ event: "ASSISTANT_MODEL_FAILED", error });
    expect(transcriptService.record).not.toHaveBeenCalled();
  });

  it("stores nothing for a conversation the user did not allow to be reviewed", async () => {
    const { akashMlClient, transcriptService, toolRunner, run } = setup();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", "search_docs", { query: "bids" })] }))
      .mockImplementationOnce(streamed({ content: "Answer" }));
    toolRunner.run.mockResolvedValue({ kind: "result", content: "{}", summary: "Searched the Console docs", ok: true });

    await run({ stored: false });

    expect(transcriptService.record).not.toHaveBeenCalled();
  });

  it("reports a cut answer and stores no empty answer", async () => {
    const { akashMlClient, transcriptService, run } = setup();
    akashMlClient.streamChatCompletion.mockImplementation(streamed({ finishReason: "length" }));

    expect(await run({ stored: true })).toEqual([{ type: "done", reason: "length" }]);
    expect(transcriptService.record).not.toHaveBeenCalled();
  });

  it("runs requested tools, feeds their results back and reports what was read", async () => {
    const { akashMlClient, toolRunner, transcriptService, run } = setup();
    const call = toolCall("c1", "get_deployment", { dseq: "42" });
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ content: "Let me check.", toolCalls: [call] }))
      .mockImplementationOnce(streamed({ content: "It is running." }));
    toolRunner.run.mockResolvedValue({ kind: "result", content: '{"tool":"get_deployment"}', summary: "Read deployment 42", ok: true });

    const events = await run({ stored: true, isTrialing: true });

    expect(toolRunner.run).toHaveBeenCalledWith(call, { isTrialing: true });
    expect(events).toEqual([
      { type: "text_delta", text: "Let me check." },
      { type: "tool_started", toolCallId: "c1", name: "get_deployment" },
      { type: "tool_result_summary", toolCallId: "c1", name: "get_deployment", ok: true, summary: "Read deployment 42" },
      { type: "text_delta", text: "\n\nIt is running." },
      { type: "done", reason: "stop" }
    ]);
    expect(akashMlClient.streamChatCompletion.mock.calls[1][0].messages).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "Let me check.", tool_calls: [call] },
      { role: "tool", tool_call_id: "c1", content: '{"tool":"get_deployment"}' }
    ]);
    expect(transcriptService.record.mock.calls).toEqual([
      ["conversation-1", { role: "tool", content: "Read deployment 42", toolName: "get_deployment", toolPayload: { toolCallId: "c1", ok: true } }],
      ["conversation-1", { role: "assistant", content: "Let me check.\n\nIt is running." }]
    ]);
  });

  it("emits a proposed action as a card and records it", async () => {
    const { akashMlClient, toolRunner, transcriptService, run } = setup();
    const action: AssistantAction = { type: "send_manifest_again", tier: "confirm", dseq: "42" };
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", "propose_send_manifest_again", { dseq: "42" })] }))
      .mockImplementationOnce(streamed({ content: "Confirm the card to send it." }));
    toolRunner.run.mockResolvedValue({ kind: "proposal", content: "{}", summary: "Proposed send manifest again", ok: true, proposalId: "p1", action });

    const events = await run({ stored: true });

    expect(events.slice(0, 3)).toEqual([
      { type: "tool_started", toolCallId: "c1", name: "propose_send_manifest_again" },
      { type: "action_proposal", proposalId: "p1", action },
      { type: "tool_result_summary", toolCallId: "c1", name: "propose_send_manifest_again", ok: true, summary: "Proposed send manifest again" }
    ]);
    expect(transcriptService.record).toHaveBeenCalledWith("conversation-1", {
      role: "tool",
      content: "Proposed send manifest again",
      toolName: "propose_send_manifest_again",
      toolPayload: { toolCallId: "c1", proposalId: "p1", action }
    });
  });

  it("emits the diagnosis behind a proposed fix with its card", async () => {
    const { akashMlClient, toolRunner, transcriptService, run } = setup();
    const action: AssistantAction = { type: "send_manifest_again", tier: "confirm", dseq: "42" };
    const diagnosis = { summary: "The provider lost the manifest.", evidence: ["manifest not found"] };
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", "propose_send_manifest_again", { dseq: "42", diagnosis })] }))
      .mockImplementationOnce(streamed({ content: "Confirm the card to send it." }));
    toolRunner.run.mockResolvedValue({
      kind: "proposal",
      content: "{}",
      summary: "Proposed send manifest again",
      ok: true,
      proposalId: "p1",
      action,
      diagnosis
    });

    const events = await run({ stored: true });

    expect(events[1]).toEqual({ type: "action_proposal", proposalId: "p1", action, diagnosis });
    expect(transcriptService.record).toHaveBeenCalledWith(
      "conversation-1",
      expect.objectContaining({ toolPayload: { toolCallId: "c1", proposalId: "p1", action, diagnosis } })
    );
  });

  it("signals live help without showing it as something the assistant read", async () => {
    const { akashMlClient, toolRunner, transcriptService, run } = setup();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", "suggest_live_help", { reason: "provider_side_issue" })] }))
      .mockImplementationOnce(streamed({ content: "Ask on Discord. What were you trying to do?" }));
    toolRunner.run.mockResolvedValue({ kind: "live_help", content: '{"shownToUser":true}', reason: "provider_side_issue" });

    const events = await run({ stored: true });

    expect(events).toEqual([
      { type: "live_help_suggested", reason: "provider_side_issue" },
      { type: "text_delta", text: "Ask on Discord. What were you trying to do?" },
      { type: "done", reason: "stop" }
    ]);
    expect(akashMlClient.streamChatCompletion.mock.calls[1][0].messages).toContainEqual({ role: "tool", tool_call_id: "c1", content: '{"shownToUser":true}' });
    expect(transcriptService.record).toHaveBeenCalledWith("conversation-1", {
      role: "tool",
      content: "Suggested live help on Discord",
      toolName: "suggest_live_help",
      toolPayload: { toolCallId: "c1", reason: "provider_side_issue" }
    });
  });

  it("keeps a refused live help call out of the reads", async () => {
    const { akashMlClient, toolRunner, run } = setup();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", "suggest_live_help", { reason: "bored" })] }))
      .mockImplementationOnce(streamed({ content: "Ask on Discord." }));
    toolRunner.run.mockResolvedValue({ kind: "result", content: "{}", summary: "Could not run suggest_live_help", ok: false });

    const events = await run({ stored: false });

    expect(events.map(({ type }) => type)).toEqual(["text_delta", "done"]);
  });

  it("pauses on a browser tool, holding the turn so far, after running the server tools of the round", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    const { akashMlClient, toolRunner, pendingTurnRepository, transcriptService, run } = setup();
    const logs = toolCall("c1", "read_logs", { dseq: "42" });
    const deployment = toolCall("c2", "get_deployment", { dseq: "42" });
    akashMlClient.streamChatCompletion.mockImplementationOnce(streamed({ content: "Reading logs.", toolCalls: [logs, deployment] }));
    toolRunner.run.mockResolvedValueOnce({ kind: "client", call: { id: "c1", name: "read_logs", arguments: { dseq: "42", tailLines: 100 } } });
    toolRunner.run.mockResolvedValueOnce({ kind: "result", content: "{}", summary: "Read deployment 42", ok: true });

    const events = await run({ stored: true, isTrialing: false, roundsUsed: 2 });

    expect(events).toEqual([
      { type: "text_delta", text: "Reading logs." },
      { type: "tool_started", toolCallId: "c1", name: "read_logs" },
      { type: "client_tool_request", toolCallId: "c1", name: "read_logs", arguments: { dseq: "42", tailLines: 100 }, maxLength: 16_000 },
      { type: "tool_started", toolCallId: "c2", name: "get_deployment" },
      { type: "tool_result_summary", toolCallId: "c2", name: "get_deployment", ok: true, summary: "Read deployment 42" },
      { type: "done", reason: "awaiting_client_tool" }
    ]);
    expect(pendingTurnRepository.hold).toHaveBeenCalledWith({
      conversationId: "conversation-1",
      userId: "user-1",
      state: {
        messages: [
          { role: "user", content: "hi" },
          { role: "assistant", content: "Reading logs.", tool_calls: [logs, deployment] },
          { role: "tool", tool_call_id: "c2", content: "{}" }
        ],
        clientToolCalls: [logs],
        roundsUsed: 3,
        stored: true,
        isTrialing: false
      },
      expiresAt: new Date(NOW.getTime() + PENDING_TURN_TTL_MS)
    });
    expect(transcriptService.record).toHaveBeenLastCalledWith("conversation-1", { role: "assistant", content: "Reading logs." });
  });

  it("stops offering tools after the last round and ends the turn with whatever the model says", async () => {
    const { akashMlClient, toolRunner, run } = setup();
    akashMlClient.streamChatCompletion.mockImplementation(streamed({ content: "still checking", toolCalls: [toolCall("c", "get_bids", { dseq: "1" })] }));
    toolRunner.run.mockResolvedValue({ kind: "result", content: "{}", summary: "Read the bids on deployment 1", ok: true });

    const events = await run({});

    expect(akashMlClient.streamChatCompletion).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS + 1);
    expect(akashMlClient.streamChatCompletion.mock.calls.map(([request]) => request.tool_choice)).toEqual([...Array(MAX_TOOL_ROUNDS).fill("auto"), "none"]);
    expect(toolRunner.run).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
    expect(events.at(-1)).toEqual({ type: "done", reason: "stop" });
  });

  it("counts the rounds a resumed turn already used", async () => {
    const { akashMlClient, run } = setup();
    akashMlClient.streamChatCompletion.mockImplementation(streamed({ content: "done", toolCalls: [toolCall("c", "get_bids", { dseq: "1" })] }));

    await run({ roundsUsed: MAX_TOOL_ROUNDS });

    expect(akashMlClient.streamChatCompletion).toHaveBeenCalledTimes(1);
    expect(akashMlClient.streamChatCompletion.mock.calls[0][0].tool_choice).toBe("none");
  });

  it.each([
    new AkashMlUnavailableError(),
    new AkashMlRequestError("AkashML answered 500", 500),
    new AkashMlOutputError("bad shape"),
    createError(503, "over budget")
  ])("reports %s as the assistant being unavailable", async error => {
    const { akashMlClient, logger, run } = setup();
    akashMlClient.streamChatCompletion.mockRejectedValue(error);

    expect(await run({})).toEqual([
      { type: "error", code: "assistant_unavailable", message: "The assistant is unavailable right now. Ask on Discord for live help." }
    ]);
    expect(logger.warn).toHaveBeenCalledWith({ event: "ASSISTANT_MODEL_FAILED", error });
  });

  it("reports an exhausted budget before calling the model", async () => {
    const { akashMlClient, limitsService, run } = setup();
    limitsService.assertWithinBudget.mockRejectedValue(createError(503, "over budget"));

    expect(await run({})).toEqual([expect.objectContaining({ type: "error", code: "assistant_unavailable" })]);
    expect(akashMlClient.streamChatCompletion).not.toHaveBeenCalled();
  });

  it("reports other failures generically and logs them", async () => {
    const { akashMlClient, logger, run } = setup();
    const error = createError(400, "bad");
    akashMlClient.streamChatCompletion.mockRejectedValue(error);

    expect(await run({})).toEqual([{ type: "error", code: "assistant_error", message: "Something went wrong. Try again, or ask on Discord." }]);
    expect(logger.error).toHaveBeenCalledWith({ event: "ASSISTANT_TURN_FAILED", error });
  });

  it("reports a turn that ran out of time", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort());
    const { akashMlClient, run } = setup();
    akashMlClient.streamChatCompletion.mockRejectedValue(new Error("aborted"));

    expect(await run({})).toEqual([
      { type: "error", code: "assistant_timeout", message: "The assistant took too long to answer. Try again, or ask on Discord." }
    ]);
    expect(timeout).toHaveBeenCalledWith(TURN_TIMEOUT_MS);
  });

  it("stops quietly when the user left", async () => {
    const { akashMlClient, run } = setup();
    akashMlClient.streamChatCompletion.mockRejectedValue(new Error("aborted"));

    expect(await run({}, AbortSignal.abort())).toEqual([]);
  });

  it("aborts the model call when the user leaves", async () => {
    const { akashMlClient, run } = setup();
    const controller = new AbortController();
    akashMlClient.streamChatCompletion.mockImplementation(streamed({ content: "late" }));

    await run({}, controller.signal);
    const signal = akashMlClient.streamChatCompletion.mock.calls[0][1]?.signal;
    controller.abort();

    expect(signal?.aborted).toBe(true);
  });

  function setup() {
    const akashMlClient = mock<AkashMlClient>();
    const toolRunner = mock<AssistantToolRunnerService>();
    const limitsService = mock<AssistantLimitsService>();
    const transcriptService = mock<AssistantTranscriptService>();
    const pendingTurnRepository = mock<AssistantPendingTurnRepository>();
    const logger = mock<ReturnType<CreateLogger>>();
    const config = envSchema.parse({ ASSISTANT_MODEL: "assistant-model" });
    const service = new AssistantTurnService(
      akashMlClient,
      toolRunner,
      limitsService,
      transcriptService,
      pendingTurnRepository,
      config,
      vi.fn<CreateLogger>(() => logger)
    );

    async function run(turn: Partial<AssistantTurn>, signal = new AbortController().signal): Promise<AssistantStreamEvent[]> {
      const events: AssistantStreamEvent[] = [];
      const messages: ChatMessage[] = [{ role: "user", content: "hi" }];
      await service.run(
        { conversationId: "conversation-1", userId: "user-1", stored: false, isTrialing: null, messages, roundsUsed: 0, ...turn },
        async event => {
          events.push(event);
        },
        signal
      );

      return events;
    }

    return { service, akashMlClient, toolRunner, limitsService, transcriptService, pendingTurnRepository, logger, run };
  }
});
