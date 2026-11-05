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
    akashMlClient.createChatCompletion.mockResolvedValue(completion({ content: "Your deployment is live." }));

    const events = await run({ stored: true });

    expect(events).toEqual([
      { type: "text_delta", text: "Your deployment is live." },
      { type: "done", reason: "stop" }
    ]);
    expect(akashMlClient.createChatCompletion).toHaveBeenCalledWith(
      {
        model: "assistant-model",
        messages: [{ role: "user", content: "hi" }],
        tools: assistantChatTools(),
        tool_choice: "auto",
        max_completion_tokens: MAX_COMPLETION_TOKENS
      },
      { signal: expect.any(AbortSignal) }
    );
    expect(limitsService.assertWithinBudget).toHaveBeenCalledTimes(1);
    expect(limitsService.recordUsage).toHaveBeenCalledWith(USAGE);
    expect(transcriptService.record).toHaveBeenCalledWith("conversation-1", { role: "assistant", content: "Your deployment is live." });
    expect(service).toBeInstanceOf(AssistantTurnService);
  });

  it("stores nothing for a conversation the user did not allow to be reviewed", async () => {
    const { akashMlClient, transcriptService, toolRunner, run } = setup();
    akashMlClient.createChatCompletion
      .mockResolvedValueOnce(completion({ toolCalls: [toolCall("c1", "search_docs", { query: "bids" })] }))
      .mockResolvedValueOnce(completion({ content: "Answer" }));
    toolRunner.run.mockResolvedValue({ kind: "result", content: "{}", summary: "Searched the Console docs", ok: true });

    await run({ stored: false });

    expect(transcriptService.record).not.toHaveBeenCalled();
  });

  it("reports a cut answer and stores no empty answer", async () => {
    const { akashMlClient, transcriptService, run } = setup();
    akashMlClient.createChatCompletion.mockResolvedValue(completion({ finishReason: "length" }));

    expect(await run({ stored: true })).toEqual([{ type: "done", reason: "length" }]);
    expect(transcriptService.record).not.toHaveBeenCalled();
  });

  it("runs requested tools, feeds their results back and reports what was read", async () => {
    const { akashMlClient, toolRunner, transcriptService, run } = setup();
    const call = toolCall("c1", "get_deployment", { dseq: "42" });
    akashMlClient.createChatCompletion
      .mockResolvedValueOnce(completion({ content: "Let me check.", toolCalls: [call] }))
      .mockResolvedValueOnce(completion({ content: "It is running." }));
    toolRunner.run.mockResolvedValue({ kind: "result", content: '{"tool":"get_deployment"}', summary: "Read deployment 42", ok: true });

    const events = await run({ stored: true, isTrialing: true });

    expect(toolRunner.run).toHaveBeenCalledWith(call, { isTrialing: true });
    expect(events).toEqual([
      { type: "text_delta", text: "Let me check." },
      { type: "tool_started", toolCallId: "c1", name: "get_deployment" },
      { type: "tool_result_summary", toolCallId: "c1", name: "get_deployment", ok: true, summary: "Read deployment 42" },
      { type: "text_delta", text: "It is running." },
      { type: "done", reason: "stop" }
    ]);
    expect(akashMlClient.createChatCompletion.mock.calls[1][0].messages).toEqual([
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
    akashMlClient.createChatCompletion
      .mockResolvedValueOnce(completion({ toolCalls: [toolCall("c1", "propose_send_manifest_again", { dseq: "42" })] }))
      .mockResolvedValueOnce(completion({ content: "Confirm the card to send it." }));
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

  it("pauses on a browser tool, holding the turn so far, after running the server tools of the round", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    const { akashMlClient, toolRunner, pendingTurnRepository, transcriptService, run } = setup();
    const logs = toolCall("c1", "read_logs", { dseq: "42" });
    const deployment = toolCall("c2", "get_deployment", { dseq: "42" });
    akashMlClient.createChatCompletion.mockResolvedValueOnce(completion({ content: "Reading logs.", toolCalls: [logs, deployment] }));
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
    akashMlClient.createChatCompletion.mockResolvedValue(completion({ content: "still checking", toolCalls: [toolCall("c", "get_bids", { dseq: "1" })] }));
    toolRunner.run.mockResolvedValue({ kind: "result", content: "{}", summary: "Read the bids on deployment 1", ok: true });

    const events = await run({});

    expect(akashMlClient.createChatCompletion).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS + 1);
    expect(akashMlClient.createChatCompletion.mock.calls.map(([request]) => request.tool_choice)).toEqual([...Array(MAX_TOOL_ROUNDS).fill("auto"), "none"]);
    expect(toolRunner.run).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
    expect(events.at(-1)).toEqual({ type: "done", reason: "stop" });
  });

  it("counts the rounds a resumed turn already used", async () => {
    const { akashMlClient, run } = setup();
    akashMlClient.createChatCompletion.mockResolvedValue(completion({ content: "done", toolCalls: [toolCall("c", "get_bids", { dseq: "1" })] }));

    await run({ roundsUsed: MAX_TOOL_ROUNDS });

    expect(akashMlClient.createChatCompletion).toHaveBeenCalledTimes(1);
    expect(akashMlClient.createChatCompletion.mock.calls[0][0].tool_choice).toBe("none");
  });

  it.each([
    new AkashMlUnavailableError(),
    new AkashMlRequestError("AkashML answered 500", 500),
    new AkashMlOutputError("bad shape"),
    createError(503, "over budget")
  ])("reports %s as the assistant being unavailable", async error => {
    const { akashMlClient, logger, run } = setup();
    akashMlClient.createChatCompletion.mockRejectedValue(error);

    expect(await run({})).toEqual([
      { type: "error", code: "assistant_unavailable", message: "The assistant is unavailable right now. Ask on Discord for live help." }
    ]);
    expect(logger.warn).toHaveBeenCalledWith({ event: "ASSISTANT_MODEL_FAILED", error });
  });

  it("reports an exhausted budget before calling the model", async () => {
    const { akashMlClient, limitsService, run } = setup();
    limitsService.assertWithinBudget.mockRejectedValue(createError(503, "over budget"));

    expect(await run({})).toEqual([expect.objectContaining({ type: "error", code: "assistant_unavailable" })]);
    expect(akashMlClient.createChatCompletion).not.toHaveBeenCalled();
  });

  it("reports other failures generically and logs them", async () => {
    const { akashMlClient, logger, run } = setup();
    const error = createError(400, "bad");
    akashMlClient.createChatCompletion.mockRejectedValue(error);

    expect(await run({})).toEqual([{ type: "error", code: "assistant_error", message: "Something went wrong. Try again, or ask on Discord." }]);
    expect(logger.error).toHaveBeenCalledWith({ event: "ASSISTANT_TURN_FAILED", error });
  });

  it("reports a turn that ran out of time", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort());
    const { akashMlClient, run } = setup();
    akashMlClient.createChatCompletion.mockRejectedValue(new Error("aborted"));

    expect(await run({})).toEqual([
      { type: "error", code: "assistant_timeout", message: "The assistant took too long to answer. Try again, or ask on Discord." }
    ]);
    expect(timeout).toHaveBeenCalledWith(TURN_TIMEOUT_MS);
  });

  it("stops quietly when the user left", async () => {
    const { akashMlClient, run } = setup();
    akashMlClient.createChatCompletion.mockRejectedValue(new Error("aborted"));

    expect(await run({}, AbortSignal.abort())).toEqual([]);
  });

  it("aborts the model call when the user leaves", async () => {
    const { akashMlClient, run } = setup();
    const controller = new AbortController();
    akashMlClient.createChatCompletion.mockResolvedValue(completion({ content: "late" }));

    await run({}, controller.signal);
    const signal = akashMlClient.createChatCompletion.mock.calls[0][1]?.signal;
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
