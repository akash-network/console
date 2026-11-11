import type { HttpClient } from "@akashnetwork/http-sdk";
import { AxiosHeaders, type AxiosResponse } from "axios";
import createError from "http-errors";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { envSchema } from "@src/feedback/config/env.config";
import type { AssistantAction } from "@src/feedback/http-schemas/assistant-action.schema";
import type { AssistantStreamEvent } from "@src/feedback/http-schemas/assistant-conversation.schema";
import { ASSISTANT_PROMPT_VERSION } from "@src/feedback/lib/assistant-prompt-version/assistant-prompt-version";
import { assistantChatToolsFor } from "@src/feedback/lib/assistant-tools/assistant-tools";
import type { AssistantPendingTurnRepository } from "@src/feedback/repositories/assistant-pending-turn/assistant-pending-turn.repository";
import type { AssistantTurnTraceRepository } from "@src/feedback/repositories/assistant-turn-trace/assistant-turn-trace.repository";
import {
  AkashMlClient,
  AkashMlOutputError,
  AkashMlRequestError,
  AkashMlUnavailableError,
  type ChatCompletion,
  type ChatCompletionRequest,
  type ChatToolCall
} from "@src/feedback/services/akashml-client/akashml.client";
import { AssistantAnswerSigner } from "@src/feedback/services/assistant-answer-signer/assistant-answer-signer.service";
import type { AssistantLimitsService } from "@src/feedback/services/assistant-limits/assistant-limits.service";
import { type AssistantToolRunnerService, toolContentOf, type ToolOutcome } from "@src/feedback/services/assistant-tool-runner/assistant-tool-runner.service";
import type { AssistantTranscriptService } from "@src/feedback/services/assistant-transcript/assistant-transcript.service";
import {
  ANSWER_NOW_NOTE,
  type AssistantTurn,
  AssistantTurnService,
  type EmitAssistantEvent,
  LAST_TOOL_ROUND_NOTE,
  MAX_COMPLETION_TOKENS,
  MAX_PARALLEL_READS,
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

function assistantTurn(overrides: Partial<AssistantTurn> = {}): AssistantTurn {
  return {
    conversationId: "conversation-1",
    userId: "user-1",
    organizationId: null,
    page: null,
    stored: false,
    isTrialing: null,
    configureFormOpen: false,
    messages: [{ role: "user", content: "hi" }],
    roundsUsed: 0,
    earlierAnswerText: "",
    ...overrides
  };
}

function akashMlStream(delta: Record<string, unknown>): AxiosResponse<Readable> {
  const chunk = { choices: [{ index: 0, delta, finish_reason: delta.tool_calls ? "tool_calls" : "stop" }] };
  const data = Readable.from([`data: ${JSON.stringify(chunk)}\n\n`, "data: [DONE]\n\n"].map(line => Buffer.from(line)));

  return { data, status: 200, statusText: "", headers: {}, config: { headers: new AxiosHeaders() } };
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
      { type: "done", reason: "stop", answerSignature: expect.any(String) }
    ]);
    expect(akashMlClient.streamChatCompletion).toHaveBeenCalledWith(
      {
        model: "assistant-model",
        messages: [{ role: "user", content: "hi" }],
        tools: assistantChatToolsFor({ configureFormOpen: false, consoleApiCatalog: "Projects: /v1/projects" }),
        tool_choice: "auto",
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        reasoning_effort: "medium"
      },
      { signal: expect.any(AbortSignal), onContentDelta: expect.any(Function) }
    );
    expect(limitsService.assertWithinBudget).toHaveBeenCalledTimes(1);
    expect(limitsService.recordUsage).toHaveBeenCalledWith(USAGE);
    expect(transcriptService.record).toHaveBeenCalledWith("conversation-1", { role: "assistant", content: "Your deployment is live." });
    expect(service).toBeInstanceOf(AssistantTurnService);
  });

  it("offers the configure form tools only while the browser has the form open", async () => {
    const { akashMlClient, toolRunner, run } = setup();
    akashMlClient.streamChatCompletion.mockImplementation(streamed({ content: "Done." }));

    await run({ configureFormOpen: true });
    await run({ configureFormOpen: false });

    expect(toolRunner.chatTools.mock.calls).toEqual([[{ configureFormOpen: true }], [{ configureFormOpen: false }]]);
    const offered = akashMlClient.streamChatCompletion.mock.calls.map(([request]) => request.tools?.map(tool => tool.function.name));
    expect(offered[0]).toEqual(expect.arrayContaining(["read_configure_form", "propose_edit_configure_form"]));
    expect(offered[1]).not.toContain("read_configure_form");
    expect(offered[1]).not.toContain("propose_edit_configure_form");
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
      { type: "done", reason: "stop", answerSignature: expect.any(String) }
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

  it("reports a cut answer", async () => {
    const { akashMlClient, run } = setup();
    akashMlClient.streamChatCompletion.mockImplementation(streamed({ content: "Your deployment", finishReason: "length" }));

    expect((await run({})).at(-1)).toEqual({ type: "done", reason: "length", answerSignature: expect.any(String) });
  });

  it("asks once more without tools when the model ends the turn with no visible answer, and stores that answer", async () => {
    const { akashMlClient, transcriptService, logger, run } = setup();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ content: "  ", finishReason: "length" }))
      .mockImplementationOnce(streamed({ content: "It closed with no bids. Ask me why." }));

    const events = await run({ stored: true });

    expect(akashMlClient.streamChatCompletion).toHaveBeenCalledTimes(2);
    expect(akashMlClient.streamChatCompletion.mock.calls[1][0]).toMatchObject({
      messages: [{ role: "user", content: "hi" }, ANSWER_NOW_NOTE],
      tool_choice: "none"
    });
    expect(events.at(-2)).toEqual({ type: "text_delta", text: "\n\nIt closed with no bids. Ask me why." });
    expect(events.at(-1)).toEqual({ type: "done", reason: "stop", answerSignature: expect.any(String) });
    expect(transcriptService.record).toHaveBeenCalledWith("conversation-1", { role: "assistant", content: "  \n\nIt closed with no bids. Ask me why." });
    expect(logger.info).toHaveBeenCalledWith({ event: "ASSISTANT_EMPTY_ANSWER_RECOVERED", recoveredBy: "answer_now" });
  });

  it("answers with what it read and a next step when the model stays silent twice", async () => {
    const { akashMlClient, toolRunner, transcriptService, logger, run } = setup();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", "get_bids", { dseq: "42" })] }))
      .mockImplementation(streamed({}));
    toolRunner.run.mockResolvedValue({
      kind: "result",
      content: toolContentOf("get_bids", { data: { dseq: "42", name: "web", bids: [], leaseCount: 0 } }),
      summary: "Read the bids on deployment web",
      ok: true
    });
    const answer =
      'I read the bids on deployment web, but could not finish my answer. Next step: ask "Why no bids on deployment web?", or redeploy it from the deployment editor with changed requirements.';

    const events = await run({ stored: true });

    expect(akashMlClient.streamChatCompletion).toHaveBeenCalledTimes(3);
    expect(events.slice(-2)).toEqual([
      { type: "text_delta", text: answer },
      { type: "done", reason: "stop", answerSignature: expect.any(String) }
    ]);
    expect(transcriptService.record).toHaveBeenLastCalledWith("conversation-1", { role: "assistant", content: answer });
    expect(logger.info).toHaveBeenCalledWith({ event: "ASSISTANT_EMPTY_ANSWER_RECOVERED", recoveredBy: "fallback" });
  });

  it("recovers a silent forced final round", async () => {
    const { akashMlClient, toolRunner, run } = setup();
    akashMlClient.streamChatCompletion.mockImplementation(async request =>
      completion(
        request.tool_choice === "auto" ? { toolCalls: [toolCall(`c${request.messages.length}`, "get_bids", { dseq: `${request.messages.length}` })] } : {}
      )
    );
    toolRunner.run.mockResolvedValue({ kind: "result", content: "{}", summary: "Read", ok: true });

    const events = await run({});

    expect(akashMlClient.streamChatCompletion).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS + 2);
    expect(events.at(-2)).toMatchObject({ type: "text_delta", text: expect.stringContaining("Next step") });
  });

  it("tells the model its last tool round and to answer in the round after it", async () => {
    const { akashMlClient, toolRunner, run } = setup();
    akashMlClient.streamChatCompletion.mockImplementation(async request =>
      completion({ content: "checking", toolCalls: [toolCall(`c${request.messages.length}`, "get_bids", { dseq: `${request.messages.length}` })] })
    );
    toolRunner.run.mockResolvedValue({ kind: "result", content: "{}", summary: "Read", ok: true });

    await run({});

    const lastMessages = akashMlClient.streamChatCompletion.mock.calls.map(([request]) => request.messages.at(-1));
    expect(lastMessages.slice(0, MAX_TOOL_ROUNDS - 1)).not.toContainEqual(LAST_TOOL_ROUND_NOTE);
    expect(lastMessages.slice(0, MAX_TOOL_ROUNDS - 1)).not.toContainEqual(ANSWER_NOW_NOTE);
    expect(lastMessages[MAX_TOOL_ROUNDS - 1]).toEqual(LAST_TOOL_ROUND_NOTE);
    expect(lastMessages[MAX_TOOL_ROUNDS]).toEqual(ANSWER_NOW_NOTE);
  });

  it("returns the earlier result of a repeated call instead of running it again, without showing another read", async () => {
    const { akashMlClient, toolRunner, transcriptService, run } = setup();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", "list_deployments", { state: "closed", search: "dart" })] }))
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c2", "list_deployments", { search: "dart", state: "closed" })] }))
      .mockImplementationOnce(streamed({ content: "It closed." }));
    toolRunner.run.mockResolvedValue({ kind: "result", content: '{"tool":"list_deployments","data":{"total":1}}', summary: "Read your deployments", ok: true });

    const events = await run({ stored: true });

    expect(toolRunner.run).toHaveBeenCalledTimes(1);
    expect(events.filter(({ type }) => type === "tool_started")).toHaveLength(1);
    expect(transcriptService.record).toHaveBeenCalledTimes(2);
    expect(JSON.parse(akashMlClient.streamChatCompletion.mock.calls[2][0].messages.at(-1)!.content as string)).toEqual({
      tool: "list_deployments",
      data: {
        note: "Already read this turn, so this is the earlier result. Answer from it instead of calling the tool again.",
        earlierResult: { tool: "list_deployments", data: { total: 1 } }
      }
    });
  });

  it("returns an earlier result that is not JSON as it was", async () => {
    const { akashMlClient, toolRunner, run } = setup();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", "get_bids", { dseq: "42" }), toolCall("c2", "get_bids", { dseq: "42" })] }))
      .mockImplementationOnce(streamed({ content: "No bids." }));
    toolRunner.run.mockResolvedValue({ kind: "result", content: "cut...[truncated]", summary: "Read the bids on deployment 42", ok: true });

    await run({});

    expect(JSON.parse(akashMlClient.streamChatCompletion.mock.calls[1][0].messages.at(-1)!.content as string).data.earlierResult).toBe("cut...[truncated]");
  });

  it("remembers what a resumed turn read before it paused", async () => {
    const { akashMlClient, toolRunner, run } = setup();
    const earlier = toolCall("c1", "get_bids", { dseq: "42" });
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c2", "get_bids", { dseq: "42" })] }))
      .mockImplementationOnce(streamed({ content: "No bids." }));

    await run({
      roundsUsed: 1,
      messages: [
        { role: "user", content: "why?" },
        { role: "assistant", content: null, tool_calls: [earlier] },
        { role: "tool", tool_call_id: "c1", content: "{}" }
      ]
    });

    expect(toolRunner.run).not.toHaveBeenCalled();
  });

  it("runs a call again in a new turn", async () => {
    const { akashMlClient, toolRunner, run } = setup();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c2", "get_bids", { dseq: "42" })] }))
      .mockImplementationOnce(streamed({ content: "No bids." }));
    toolRunner.run.mockResolvedValue({ kind: "result", content: "{}", summary: "Read the bids on deployment 42", ok: true });

    await run({
      messages: [
        { role: "user", content: "why?" },
        { role: "assistant", content: null, tool_calls: [toolCall("c1", "get_bids", { dseq: "42" })] },
        { role: "tool", tool_call_id: "c1", content: "{}" },
        { role: "assistant", content: "No bids." },
        { role: "user", content: "and now?" }
      ]
    });

    expect(toolRunner.run).toHaveBeenCalledTimes(1);
  });

  it("runs requested tools, feeds their results back and reports what was read", async () => {
    const { akashMlClient, toolRunner, transcriptService, run } = setup();
    const call = toolCall("c1", "get_deployment", { dseq: "42" });
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ content: "Let me check.", toolCalls: [call] }))
      .mockImplementationOnce(streamed({ content: "It is running." }));
    toolRunner.run.mockResolvedValue({ kind: "result", content: '{"tool":"get_deployment"}', summary: "Read deployment 42", ok: true });

    const events = await run({ stored: true, isTrialing: true, configureFormOpen: true });

    expect(toolRunner.run).toHaveBeenCalledWith(call, { isTrialing: true, configureFormOpen: true, withheldTemplateSdls: [] });
    expect(events).toEqual([
      { type: "text_delta", text: "Let me check." },
      { type: "tool_started", toolCallId: "c1", name: "get_deployment" },
      { type: "tool_result_summary", toolCallId: "c1", name: "get_deployment", ok: true, summary: "Read deployment 42" },
      { type: "text_delta", text: "\n\nIt is running." },
      { type: "done", reason: "stop", answerSignature: expect.any(String) }
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

  it("feeds back each tool call the model streamed without an id under the same id it reports", async () => {
    const { akashMlHttpClient, toolRunner, run } = setup({ streamsFromAkashMl: true });
    akashMlHttpClient.post
      .mockResolvedValueOnce(
        akashMlStream({
          tool_calls: [
            { index: 0, type: "function", function: { name: "get_deployment", arguments: '{"dseq":"42"}' } },
            { index: 1, type: "function", function: { name: "get_bids", arguments: '{"dseq":"42"}' } }
          ]
        })
      )
      .mockResolvedValueOnce(akashMlStream({ content: "It is running." }));
    toolRunner.run
      .mockResolvedValueOnce({ kind: "result", content: '{"tool":"get_deployment"}', summary: "Read deployment 42", ok: true })
      .mockResolvedValueOnce({ kind: "result", content: '{"tool":"get_bids"}', summary: "Read bids", ok: true });

    const events = await run({});
    const [deployment, bids] = toolRunner.run.mock.calls.map(([call]) => call);
    const nextRequest = akashMlHttpClient.post.mock.calls[1][1] as ChatCompletionRequest;

    expect([deployment.id, bids.id]).toEqual([expect.stringMatching(/^call_./), expect.stringMatching(/^call_./)]);
    expect(deployment.id).not.toBe(bids.id);
    expect(nextRequest.messages).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: null, tool_calls: [deployment, bids] },
      { role: "tool", tool_call_id: deployment.id, content: '{"tool":"get_deployment"}' },
      { role: "tool", tool_call_id: bids.id, content: '{"tool":"get_bids"}' }
    ]);
    expect(events).toEqual([
      { type: "tool_started", toolCallId: deployment.id, name: "get_deployment" },
      { type: "tool_started", toolCallId: bids.id, name: "get_bids" },
      { type: "tool_result_summary", toolCallId: deployment.id, name: "get_deployment", ok: true, summary: "Read deployment 42" },
      { type: "tool_result_summary", toolCallId: bids.id, name: "get_bids", ok: true, summary: "Read bids" },
      { type: "text_delta", text: "It is running." },
      { type: "done", reason: "stop", answerSignature: expect.any(String) }
    ]);
  });

  it("runs the reads that open a round at once and feeds their results back in the order the model asked", async () => {
    const { akashMlClient, toolRunner, run } = setup();
    const bidsRead = Promise.withResolvers<ToolOutcome>();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", "get_bids", { dseq: "42" }), toolCall("c2", "get_deployment", { dseq: "42" })] }))
      .mockImplementationOnce(streamed({ content: "Done." }));
    toolRunner.run.mockImplementation(async call =>
      call.function.name === "get_bids" ? bidsRead.promise : { kind: "result", content: "deployment", summary: "Read deployment 42", ok: true }
    );

    const turn = run({});
    await vi.waitFor(() => expect(toolRunner.run).toHaveBeenCalledTimes(2));
    bidsRead.resolve({ kind: "result", content: "bids", summary: "Read the bids on deployment 42", ok: true });
    await turn;

    expect(akashMlClient.streamChatCompletion.mock.calls[1][0].messages.slice(-2)).toEqual([
      { role: "tool", tool_call_id: "c1", content: "bids" },
      { role: "tool", tool_call_id: "c2", content: "deployment" }
    ]);
  });

  it("starts at most MAX_PARALLEL_READS reads at once and runs the rest of the round after them", async () => {
    const { akashMlClient, toolRunner, run } = setup();
    const reads = Array.from({ length: MAX_PARALLEL_READS + 1 }, (_, index) => toolCall(`c${index}`, "get_deployment", { dseq: `${index}` }));
    const firstRead = Promise.withResolvers<ToolOutcome>();
    akashMlClient.streamChatCompletion.mockImplementationOnce(streamed({ toolCalls: reads })).mockImplementationOnce(streamed({ content: "Done." }));
    toolRunner.run.mockImplementation(async call => (call.id === "c0" ? firstRead.promise : { kind: "result", content: call.id, summary: "Read", ok: true }));

    const turn = run({});
    await vi.waitFor(() => expect(toolRunner.run).toHaveBeenCalledTimes(MAX_PARALLEL_READS));
    firstRead.resolve({ kind: "result", content: "c0", summary: "Read", ok: true });
    await turn;

    expect(toolRunner.run.mock.calls.map(([call]) => call.id)).toEqual(reads.map(({ id }) => id));
    expect(akashMlClient.streamChatCompletion.mock.calls[1][0].messages.slice(-reads.length)).toEqual(
      reads.map(({ id }) => ({ role: "tool", tool_call_id: id, content: id }))
    );
  });

  it("runs a read after a card only once the card is proposed, and a repeated read once", async () => {
    const { akashMlClient, toolRunner, run } = setup();
    const order: string[] = [];
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(
        streamed({
          toolCalls: [
            toolCall("c1", "get_bids", { dseq: "42" }),
            toolCall("c2", "get_bids", { dseq: "42" }),
            toolCall("c3", "propose_rename_deployment", { dseq: "42", name: "web" }),
            toolCall("c4", "check_availability", { templateId: "hello" })
          ]
        })
      )
      .mockImplementationOnce(streamed({ content: "Done." }));
    toolRunner.run.mockImplementation(async call => {
      order.push(call.id);
      return { kind: "result", content: "{}", summary: "Read", ok: true };
    });

    const events = await run({});

    expect(order).toEqual(["c1", "c3", "c4"]);
    expect(events.filter(({ type }) => type === "tool_started").map(event => ("toolCallId" in event ? event.toolCallId : null))).toEqual(["c1", "c3", "c4"]);
  });

  it("keeps the SDLs held back earlier in the turn for the proposals after them", async () => {
    const { akashMlClient, toolRunner, run } = setup();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", "propose_create_deployment", { templateId: "dart" })] }))
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c2", "propose_create_deployment", { sdl: "adjusted" })] }))
      .mockImplementationOnce(streamed({ content: "Adjusted." }));
    const withheldTemplateSdlsSeen: string[][] = [];
    toolRunner.run.mockImplementation(async (_, context) => {
      withheldTemplateSdlsSeen.push([...context.withheldTemplateSdls]);
      context.withheldTemplateSdls.push("dart sdl");
      return { kind: "result", content: "{}", summary: "Held back a proposal no provider can bid on", ok: false };
    });

    await run({});

    expect(withheldTemplateSdlsSeen).toEqual([[], ["dart sdl"]]);
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
      { type: "done", reason: "stop", answerSignature: expect.any(String) }
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

    const events = await run({ stored: true, isTrialing: false, configureFormOpen: true, roundsUsed: 2, organizationId: "org-1", page: "/deployments/42" });

    expect(events).toEqual([
      { type: "text_delta", text: "Reading logs." },
      { type: "tool_started", toolCallId: "c1", name: "read_logs" },
      { type: "client_tool_request", toolCallId: "c1", name: "read_logs", arguments: { dseq: "42", tailLines: 100 }, maxLength: 16_000 },
      { type: "tool_started", toolCallId: "c2", name: "get_deployment" },
      { type: "tool_result_summary", toolCallId: "c2", name: "get_deployment", ok: true, summary: "Read deployment 42" },
      { type: "done", reason: "awaiting_client_tool", answerSignature: expect.any(String) }
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
        isTrialing: false,
        configureFormOpen: true,
        organizationId: "org-1",
        page: "/deployments/42",
        shownText: "Reading logs."
      },
      expiresAt: new Date(NOW.getTime() + PENDING_TURN_TTL_MS)
    });
    expect(transcriptService.record).toHaveBeenLastCalledWith("conversation-1", { role: "assistant", content: "Reading logs." });
  });

  it("stops offering tools after the last round and ends the turn with whatever the model says", async () => {
    const { akashMlClient, toolRunner, run } = setup();
    akashMlClient.streamChatCompletion.mockImplementation(async (request, { onContentDelta }) => {
      await onContentDelta("still checking");
      return completion({
        content: "still checking",
        toolCalls: [toolCall(`c${request.messages.length}`, "get_bids", { dseq: `${request.messages.length}` })]
      });
    });
    toolRunner.run.mockResolvedValue({ kind: "result", content: "{}", summary: "Read the bids on deployment 1", ok: true });

    const events = await run({});

    expect(akashMlClient.streamChatCompletion).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS + 1);
    expect(events.at(-2)).toEqual({ type: "text_delta", text: "\n\nstill checking" });
    expect(akashMlClient.streamChatCompletion.mock.calls.map(([request]) => request.tool_choice)).toEqual([...Array(MAX_TOOL_ROUNDS).fill("auto"), "none"]);
    expect(toolRunner.run).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
    expect(events.at(-1)).toEqual({ type: "done", reason: "stop", answerSignature: expect.any(String) });
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

  it("answers a turn that ran out of time with what it read, and logs it", async () => {
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    const { akashMlClient, toolRunner, transcriptService, logger, run } = setup();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ content: "Let me check.", toolCalls: [toolCall("c1", "list_deployments")] }))
      .mockImplementationOnce(async () => {
        deadline.abort();
        throw new Error("aborted");
      });
    toolRunner.run.mockResolvedValue({ kind: "result", content: "{}", summary: "Read your deployments", ok: true });

    const events = await run({ stored: true });

    const fallback = "I read your deployments, but could not finish my answer. Next step: ask again in a shorter question, or ask on Discord for live help.";
    expect(events.slice(-2)).toEqual([
      { type: "text_delta", text: `\n\n${fallback}` },
      { type: "done", reason: "stop", answerSignature: expect.any(String) }
    ]);
    expect(logger.warn).toHaveBeenCalledWith({ event: "ASSISTANT_TURN_TIMED_OUT", round: 1, timeoutMs: TURN_TIMEOUT_MS });
    expect(transcriptService.record).toHaveBeenLastCalledWith("conversation-1", { role: "assistant", content: `Let me check.\n\n${fallback}` });
    expect(timeout).toHaveBeenCalledWith(TURN_TIMEOUT_MS);
  });

  it("keeps the text a timed-out completion already streamed, apart from the answer that follows it", async () => {
    const deadline = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    const { akashMlClient, transcriptService, run } = setup();
    akashMlClient.streamChatCompletion.mockImplementation(async (_request, { onContentDelta }) => {
      await onContentDelta("Your deployment ");
      await onContentDelta("is ");
      deadline.abort();
      throw new Error("aborted");
    });

    const events = await run({ stored: true });

    const fallback = "I could not finish my answer this time. Next step: ask again in a shorter question, or ask on Discord for live help.";
    expect(events).toEqual([
      { type: "text_delta", text: "Your deployment " },
      { type: "text_delta", text: "is " },
      { type: "text_delta", text: `\n\n${fallback}` },
      { type: "done", reason: "stop", answerSignature: expect.any(String) }
    ]);
    expect(transcriptService.record).toHaveBeenLastCalledWith("conversation-1", { role: "assistant", content: `Your deployment is \n\n${fallback}` });
  });

  it("answers a turn that ran out of time before reading anything, and stores that answer", async () => {
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort());
    const { akashMlClient, transcriptService, run } = setup();
    akashMlClient.streamChatCompletion.mockRejectedValue(new Error("aborted"));
    const fallback = "I could not finish my answer this time. Next step: ask again in a shorter question, or ask on Discord for live help.";

    expect(await run({ stored: true })).toEqual([
      { type: "text_delta", text: fallback },
      { type: "done", reason: "stop", answerSignature: expect.any(String) }
    ]);
    expect(transcriptService.record).toHaveBeenLastCalledWith("conversation-1", { role: "assistant", content: fallback });
  });

  it("signs the answer text it streamed on the done event", async () => {
    const { akashMlClient, signer, run } = setup();
    akashMlClient.streamChatCompletion.mockImplementation(streamed({ content: "Hello world" }, ["Hello", " world"]));

    const events = await run({});

    expect(events.at(-1)).toEqual({
      type: "done",
      reason: "stop",
      answerSignature: signer.sign({ userId: "user-1", conversationId: "conversation-1", text: "Hello world" })
    });
  });

  it("signs the earlier stream's text together with the resumed stream's text", async () => {
    const { akashMlClient, signer, run } = setup();
    akashMlClient.streamChatCompletion.mockImplementation(streamed({ content: " The port is wrong." }));

    const events = await run({ earlierAnswerText: "Reading your logs.", roundsUsed: 1 });

    expect(events).toEqual([
      { type: "text_delta", text: " The port is wrong." },
      {
        type: "done",
        reason: "stop",
        answerSignature: signer.sign({ userId: "user-1", conversationId: "conversation-1", text: "Reading your logs. The port is wrong." })
      }
    ]);
  });

  it("keeps the text shown so far when it pauses for a browser read", async () => {
    const { akashMlClient, toolRunner, pendingTurnRepository, signer, run } = setup();
    const logs = toolCall("c2", "read_logs", { dseq: "42" });
    akashMlClient.streamChatCompletion.mockImplementation(streamed({ content: " Reading logs.", toolCalls: [logs] }, [" Reading ", "logs."]));
    toolRunner.run.mockResolvedValue({ kind: "client", call: { id: "c2", name: "read_logs", arguments: { dseq: "42", tailLines: 100 } } });

    const events = await run({ earlierAnswerText: "Checking.", roundsUsed: 1 });

    expect(pendingTurnRepository.hold).toHaveBeenCalledWith(
      expect.objectContaining({ state: expect.objectContaining({ shownText: "Checking. Reading logs." }) })
    );
    expect(events.at(-1)).toEqual({
      type: "done",
      reason: "awaiting_client_tool",
      answerSignature: signer.sign({ userId: "user-1", conversationId: "conversation-1", text: "Checking. Reading logs." })
    });
  });

  it("signs the fallback answer of a timed out turn", async () => {
    const deadline = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    const { akashMlClient, signer, run } = setup();
    akashMlClient.streamChatCompletion.mockImplementation(async (_request, { onContentDelta }) => {
      await onContentDelta("Your deployment ");
      deadline.abort();
      throw new Error("aborted");
    });

    const events = await run({});

    const fallback = "I could not finish my answer this time. Next step: ask again in a shorter question, or ask on Discord for live help.";
    const streamedText = events.flatMap(event => (event.type === "text_delta" ? [event.text] : [])).join("");
    expect(streamedText).toBe(`Your deployment \n\n${fallback}`);
    expect(events.at(-1)).toEqual({
      type: "done",
      reason: "stop",
      answerSignature: signer.sign({ userId: "user-1", conversationId: "conversation-1", text: streamedText })
    });
  });

  it("leaves the signature out when the answer has no text", async () => {
    const { akashMlClient, toolRunner, pendingTurnRepository, run } = setup();
    const logs = toolCall("c1", "read_logs", { dseq: "42" });
    akashMlClient.streamChatCompletion.mockImplementation(streamed({ content: "  ", toolCalls: [logs] }));
    toolRunner.run.mockResolvedValue({ kind: "client", call: { id: "c1", name: "read_logs", arguments: { dseq: "42", tailLines: 100 } } });

    const events = await run({});

    expect(events.at(-1)).toEqual({ type: "done", reason: "awaiting_client_tool" });
    expect(pendingTurnRepository.hold).toHaveBeenCalledWith(expect.objectContaining({ state: expect.objectContaining({ shownText: "  " }) }));
  });

  it("sends no done event and no signature when the turn fails", async () => {
    const { akashMlClient, run } = setup();
    akashMlClient.streamChatCompletion.mockImplementation(async (_request, { onContentDelta }) => {
      await onContentDelta("Your dep");
      throw new AkashMlRequestError("AkashML stream failed: ECONNRESET", undefined);
    });

    const events = await run({});

    expect(events).toEqual([
      { type: "text_delta", text: "Your dep" },
      { type: "error", code: "assistant_unavailable", message: "The assistant is unavailable right now. Ask on Discord for live help." }
    ]);
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

  it("traces an answered turn with tokens, tool calls and time to first text", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    const { akashMlClient, toolRunner, traceRepository, run } = setup();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(async () => {
        vi.setSystemTime(NOW.getTime() + 50);
        return completion({ toolCalls: [toolCall("c1", "get_deployment", { dseq: "42" })] });
      })
      .mockImplementationOnce(async (_request, { onContentDelta }) => {
        vi.setSystemTime(NOW.getTime() + 400);
        await onContentDelta("It is ");
        vi.setSystemTime(NOW.getTime() + 450);
        await onContentDelta("running.");
        vi.setSystemTime(NOW.getTime() + 500);
        return completion({ content: "It is running." });
      });
    toolRunner.run.mockImplementation(async () => {
      vi.setSystemTime(NOW.getTime() + 300);
      return { kind: "result", content: "{}", summary: "Read deployment 42", ok: true };
    });

    await run({ organizationId: "org-1", page: "/deployments/42" });

    expect(traceRepository.start).toHaveBeenCalledTimes(1);
    expect(traceRepository.start).toHaveBeenCalledWith({
      conversationId: "conversation-1",
      userId: "user-1",
      organizationId: "org-1",
      page: "/deployments/42",
      model: "assistant-model",
      promptVersion: ASSISTANT_PROMPT_VERSION,
      startedAt: NOW,
      outcome: "running",
      firstTokenMs: null,
      durationMs: 0,
      promptTokens: 0,
      completionTokens: 0,
      toolCalls: [],
      cards: []
    });
    expect(traceRepository.finish).toHaveBeenCalledTimes(1);
    expect(traceRepository.finish).toHaveBeenCalledWith("trace-1", {
      outcome: "answered",
      firstTokenMs: 400,
      durationMs: 500,
      promptTokens: 200,
      completionTokens: 40,
      toolCalls: [{ name: "get_deployment", ok: true, durationMs: 250 }]
    });
    expect(traceRepository.create).not.toHaveBeenCalled();
  });

  it("traces a turn answered after the empty-answer retry as recovered", async () => {
    const { akashMlClient, traceRepository, run } = setup();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ content: "  " }))
      .mockImplementationOnce(streamed({ content: "It closed with no bids." }));

    await run({});

    expect(traceRepository.finish).toHaveBeenCalledTimes(1);
    expect(traceRepository.finish.mock.calls[0][1]).toMatchObject({ outcome: "recovered", promptTokens: 200, completionTokens: 40 });
  });

  it("traces a turn that fell back to the fixed answer as fallback", async () => {
    const { akashMlClient, toolRunner, traceRepository, run } = setup();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", "get_bids", { dseq: "42" })] }))
      .mockImplementation(streamed({}));
    toolRunner.run.mockResolvedValue({ kind: "result", content: "{}", summary: "Read the bids on deployment 42", ok: true });

    const events = await run({});

    expect(events.at(-2)).toMatchObject({ type: "text_delta", text: expect.stringContaining("Next step") });
    expect(traceRepository.finish.mock.calls[0][1]).toMatchObject({ outcome: "fallback", firstTokenMs: null, promptTokens: 300 });
  });

  it("traces a timed out turn as timed_out", async () => {
    const deadline = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    const { akashMlClient, toolRunner, traceRepository, run } = setup();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", "list_deployments")] }))
      .mockImplementationOnce(async () => {
        deadline.abort();
        throw new Error("aborted");
      });
    toolRunner.run.mockResolvedValue({ kind: "result", content: "{}", summary: "Read your deployments", ok: true });

    const events = await run({});

    expect(events.at(-1)).toEqual({ type: "done", reason: "stop", answerSignature: expect.any(String) });
    expect(traceRepository.finish).toHaveBeenCalledTimes(1);
    expect(traceRepository.finish.mock.calls[0][1]).toMatchObject({
      outcome: "timed_out",
      firstTokenMs: null,
      toolCalls: [{ name: "list_deployments", ok: true, durationMs: expect.any(Number) }]
    });
  });

  it("traces a turn paused for a browser read as awaiting_browser", async () => {
    const { akashMlClient, toolRunner, traceRepository, run } = setup();
    akashMlClient.streamChatCompletion.mockImplementationOnce(
      streamed({ toolCalls: [toolCall("c1", "read_logs", { dseq: "42" }), toolCall("c2", "get_deployment", { dseq: "42" })] })
    );
    toolRunner.run
      .mockResolvedValueOnce({ kind: "client", call: { id: "c1", name: "read_logs", arguments: { dseq: "42", tailLines: 100 } } })
      .mockResolvedValueOnce({ kind: "result", content: "{}", summary: "Read deployment 42", ok: false });

    await run({});

    expect(traceRepository.finish).toHaveBeenCalledTimes(1);
    expect(traceRepository.finish.mock.calls[0][1]).toMatchObject({
      outcome: "awaiting_browser",
      toolCalls: [{ name: "get_deployment", ok: false, durationMs: expect.any(Number) }]
    });
  });

  it("traces a model failure as model_failed and any other error as failed", async () => {
    const { akashMlClient, traceRepository, run } = setup();
    akashMlClient.streamChatCompletion.mockRejectedValueOnce(new AkashMlUnavailableError()).mockRejectedValueOnce(createError(400, "bad"));

    await run({});
    await run({});

    expect(traceRepository.finish.mock.calls.map(([, result]) => result.outcome)).toEqual(["model_failed", "failed"]);
  });

  it("traces a turn the user cancelled as cancelled", async () => {
    const { akashMlClient, traceRepository, run } = setup();
    akashMlClient.streamChatCompletion.mockRejectedValue(new Error("aborted"));

    expect(await run({}, AbortSignal.abort())).toEqual([]);
    expect(traceRepository.finish).toHaveBeenCalledTimes(1);
    expect(traceRepository.finish.mock.calls[0][1]).toMatchObject({ outcome: "cancelled" });
  });

  it("still traces a turn whose error it could not report", async () => {
    const { service, akashMlClient, traceRepository } = setup();
    const streamClosed = new Error("stream closed");
    akashMlClient.streamChatCompletion.mockRejectedValue(createError(400, "bad"));

    await expect(service.run(assistantTurn(), vi.fn().mockRejectedValue(streamClosed), new AbortController().signal)).rejects.toBe(streamClosed);

    expect(traceRepository.finish).toHaveBeenCalledTimes(1);
    expect(traceRepository.finish.mock.calls[0][1]).toMatchObject({ outcome: "failed" });
  });

  it("records a proposed card with no decision yet", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    const { akashMlClient, toolRunner, traceRepository, run } = setup();
    const action: AssistantAction = { type: "send_manifest_again", tier: "confirm", dseq: "42" };
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", "propose_send_manifest_again", { dseq: "42" })] }))
      .mockImplementationOnce(streamed({ content: "Confirm the card to send it." }));
    toolRunner.run.mockResolvedValue({ kind: "proposal", content: "{}", summary: "Proposed send manifest again", ok: true, proposalId: "p1", action });

    await run({});

    expect(traceRepository.appendCard).toHaveBeenCalledTimes(1);
    expect(traceRepository.appendCard).toHaveBeenCalledWith("trace-1", { proposalId: "p1", actionType: "send_manifest_again", decision: null });
    expect(traceRepository.finish.mock.calls[0][1]).toMatchObject({ toolCalls: [{ name: "propose_send_manifest_again", ok: true, durationMs: 0 }] });
  });

  it("records a card decision made while the turn is still streaming", async () => {
    const { service, akashMlClient, toolRunner, traceRepository } = setup();
    const action: AssistantAction = { type: "send_manifest_again", tier: "confirm", dseq: "42" };
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", "propose_send_manifest_again", { dseq: "42" })] }))
      .mockImplementationOnce(streamed({ content: "Confirm the card to send it." }));
    toolRunner.run.mockResolvedValue({ kind: "proposal", content: "{}", summary: "Proposed send manifest again", ok: true, proposalId: "p1", action });
    const cardTraced = vi.fn();
    traceRepository.appendCard.mockImplementation(async () => {
      await new Promise(resolve => setImmediate(resolve));
      cardTraced();
    });
    const emit = vi.fn<EmitAssistantEvent>(async () => undefined);

    await service.run(assistantTurn(), emit, new AbortController().signal);

    const cardShownOrder = emit.mock.invocationCallOrder[emit.mock.calls.findIndex(([event]) => event.type === "action_proposal")];
    expect(traceRepository.start.mock.invocationCallOrder[0]).toBeLessThan(traceRepository.appendCard.mock.invocationCallOrder[0]);
    expect(cardTraced.mock.invocationCallOrder[0]).toBeLessThan(cardShownOrder);
    expect(traceRepository.appendCard).toHaveBeenCalledWith("trace-1", { proposalId: "p1", actionType: "send_manifest_again", decision: null });
    expect(traceRepository.finish.mock.calls[0][1]).not.toHaveProperty("cards");
  });

  it("starts streaming without waiting for the provisional trace", async () => {
    const { akashMlClient, traceRepository, run } = setup();
    const provisionalTrace = Promise.withResolvers<string>();
    let provisionalTraceWritten = false;
    traceRepository.start.mockReturnValue(provisionalTrace.promise.finally(() => (provisionalTraceWritten = true)));
    let provisionalTraceWrittenAtFirstText: boolean | undefined;
    akashMlClient.streamChatCompletion.mockImplementation(async (_request, { onContentDelta }) => {
      await onContentDelta("Your deployment is live.");
      provisionalTraceWrittenAtFirstText = provisionalTraceWritten;
      provisionalTrace.resolve("trace-1");
      return completion({ content: "Your deployment is live." });
    });

    const events = await run({});

    expect(events[0]).toEqual({ type: "text_delta", text: "Your deployment is live." });
    expect(provisionalTraceWrittenAtFirstText).toBe(false);
    expect(traceRepository.finish).toHaveBeenCalledWith("trace-1", expect.objectContaining({ outcome: "answered" }));
  });

  it("falls back to inserting the whole trace when the provisional row could not be written", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    const { akashMlClient, toolRunner, traceRepository, logger, run } = setup();
    const error = new Error("db down");
    const action: AssistantAction = { type: "send_manifest_again", tier: "confirm", dseq: "42" };
    traceRepository.start.mockRejectedValue(error);
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", "propose_send_manifest_again", { dseq: "42" })] }))
      .mockImplementationOnce(streamed({ content: "Confirm the card to send it." }));
    toolRunner.run.mockResolvedValue({ kind: "proposal", content: "{}", summary: "Proposed send manifest again", ok: true, proposalId: "p1", action });

    const events = await run({});

    expect(events).toContainEqual(expect.objectContaining({ type: "action_proposal", proposalId: "p1" }));
    expect(logger.warn).toHaveBeenCalledWith({ event: "ASSISTANT_TURN_TRACE_FAILED", error });
    expect(traceRepository.appendCard).not.toHaveBeenCalled();
    expect(traceRepository.finish).not.toHaveBeenCalled();
    expect(traceRepository.create).toHaveBeenCalledTimes(1);
    expect(traceRepository.create).toHaveBeenCalledWith({
      conversationId: "conversation-1",
      userId: "user-1",
      organizationId: null,
      page: null,
      model: "assistant-model",
      promptVersion: ASSISTANT_PROMPT_VERSION,
      startedAt: NOW,
      outcome: "answered",
      firstTokenMs: 0,
      durationMs: 0,
      promptTokens: 200,
      completionTokens: 40,
      toolCalls: [{ name: "propose_send_manifest_again", ok: true, durationMs: 0 }],
      cards: [{ proposalId: "p1", actionType: "send_manifest_again", decision: null }]
    });
  });

  it("still emits the card when appending it to the trace fails", async () => {
    const { akashMlClient, toolRunner, traceRepository, logger, run } = setup();
    const error = new Error("db down");
    const action: AssistantAction = { type: "send_manifest_again", tier: "confirm", dseq: "42" };
    traceRepository.appendCard.mockRejectedValue(error);
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", "propose_send_manifest_again", { dseq: "42" })] }))
      .mockImplementationOnce(streamed({ content: "Confirm the card to send it." }));
    toolRunner.run.mockResolvedValue({ kind: "proposal", content: "{}", summary: "Proposed send manifest again", ok: true, proposalId: "p1", action });

    const events = await run({});

    expect(events).toContainEqual({ type: "action_proposal", proposalId: "p1", action });
    expect(events.at(-1)).toEqual({ type: "done", reason: "stop", answerSignature: expect.any(String) });
    expect(logger.warn).toHaveBeenCalledWith({ event: "ASSISTANT_TURN_TRACE_FAILED", error });
    expect(traceRepository.finish).toHaveBeenCalledWith("trace-1", expect.objectContaining({ outcome: "answered" }));
  });

  it("does not record a repeated call answered from the earlier result", async () => {
    const { akashMlClient, toolRunner, traceRepository, run } = setup();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", "get_bids", { dseq: "42" }), toolCall("c2", "get_bids", { dseq: "42" })] }))
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c3", "get_bids", { dseq: "42" })] }))
      .mockImplementationOnce(streamed({ content: "No bids." }));
    toolRunner.run.mockResolvedValue({ kind: "result", content: "{}", summary: "Read the bids on deployment 42", ok: true });

    await run({});

    expect(traceRepository.finish.mock.calls[0][1].toolCalls).toEqual([{ name: "get_bids", ok: true, durationMs: expect.any(Number) }]);
  });

  it("does not record suggested live help as a tool call", async () => {
    const { akashMlClient, toolRunner, traceRepository, run } = setup();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", "suggest_live_help", { reason: "provider_side_issue" })] }))
      .mockImplementationOnce(streamed({ content: "Ask on Discord." }));
    toolRunner.run.mockResolvedValue({ kind: "live_help", content: '{"shownToUser":true}', reason: "provider_side_issue" });

    await run({});

    expect(traceRepository.finish.mock.calls[0][1]).toMatchObject({ outcome: "answered", toolCalls: [] });
    expect(traceRepository.appendCard).not.toHaveBeenCalled();
  });

  it("finishes the trace only after the turn is done, so the write never holds back the answer", async () => {
    const { service, akashMlClient, traceRepository } = setup();
    akashMlClient.streamChatCompletion.mockImplementation(streamed({ content: "Done." }));
    const emit = vi.fn(async () => undefined);

    await service.run(assistantTurn(), emit, new AbortController().signal);

    expect(emit).toHaveBeenLastCalledWith({ type: "done", reason: "stop", answerSignature: expect.any(String) });
    expect(traceRepository.finish.mock.invocationCallOrder[0]).toBeGreaterThan(emit.mock.invocationCallOrder.at(-1)!);
  });

  it("still answers and logs ASSISTANT_TURN_TRACE_FAILED when the trace cannot be written", async () => {
    const { akashMlClient, traceRepository, logger, run } = setup();
    const error = new Error("db down");
    akashMlClient.streamChatCompletion.mockImplementation(streamed({ content: "Your deployment is live." }));
    traceRepository.start.mockRejectedValue(error);
    traceRepository.create.mockRejectedValue(error);

    const events = await run({});

    expect(events).toEqual([
      { type: "text_delta", text: "Your deployment is live." },
      { type: "done", reason: "stop", answerSignature: expect.any(String) }
    ]);
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith({ event: "ASSISTANT_TURN_TRACE_FAILED", error });
  });

  it("still answers when the trace cannot be finished", async () => {
    const { akashMlClient, traceRepository, logger, run } = setup();
    const error = new Error("db down");
    akashMlClient.streamChatCompletion.mockImplementation(streamed({ content: "Your deployment is live." }));
    traceRepository.finish.mockRejectedValue(error);

    const events = await run({});

    expect(events.at(-1)).toEqual({ type: "done", reason: "stop", answerSignature: expect.any(String) });
    expect(logger.warn).toHaveBeenCalledWith({ event: "ASSISTANT_TURN_TRACE_FAILED", error });
    expect(traceRepository.create).not.toHaveBeenCalled();
  });

  it("keeps the user's words out of the trace", async () => {
    const marker = "MARKER-7f3a";
    const { akashMlClient, toolRunner, traceRepository, everythingTraced, run } = setup();
    const action: AssistantAction = { type: "send_manifest_again", tier: "confirm", dseq: "42" };
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(
        streamed({
          content: `Looking for ${marker}.`,
          toolCalls: [toolCall("c1", "list_deployments", { search: marker }), toolCall("c2", "propose_send_manifest_again", { dseq: marker })]
        })
      )
      .mockImplementationOnce(streamed({ content: `${marker} is running.` }));
    toolRunner.run
      .mockResolvedValueOnce({ kind: "result", content: `{"name":"${marker}"}`, summary: `Read ${marker}`, ok: true })
      .mockResolvedValueOnce({ kind: "proposal", content: marker, summary: `Proposed ${marker}`, ok: true, proposalId: "p1", action });

    await run({ stored: true, messages: [{ role: "user", content: `where is ${marker}?` }] });

    expect(traceRepository.start).toHaveBeenCalledTimes(1);
    expect(traceRepository.appendCard).toHaveBeenCalledTimes(1);
    expect(traceRepository.finish).toHaveBeenCalledTimes(1);
    expect(everythingTraced()).not.toContain(marker);
  });

  it("records a tool the model made up under a fixed name, so its name cannot carry the user's words", async () => {
    const marker = "MARKER-7f3a";
    const { akashMlClient, toolRunner, traceRepository, everythingTraced, run } = setup();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", `find_${marker}`)] }))
      .mockImplementationOnce(streamed({ content: "I could not look that up." }));
    toolRunner.run.mockResolvedValue({ kind: "result", content: "{}", summary: "Could not run the tool", ok: false });

    await run({});

    expect(traceRepository.finish.mock.calls[0][1].toolCalls).toEqual([{ name: "unknown", ok: false, durationMs: expect.any(Number) }]);
    expect(everythingTraced()).not.toContain(marker);
  });

  it("keeps the user's words out of a trace written whole after the provisional row failed", async () => {
    const marker = "MARKER-7f3a";
    const { akashMlClient, toolRunner, traceRepository, everythingTraced, run } = setup();
    traceRepository.start.mockRejectedValue(new Error("db down"));
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", `find_${marker}`)] }))
      .mockImplementationOnce(streamed({ content: `${marker} is running.` }));
    toolRunner.run.mockResolvedValue({ kind: "result", content: marker, summary: `Read ${marker}`, ok: false });

    await run({ stored: true, messages: [{ role: "user", content: `where is ${marker}?` }] });

    expect(traceRepository.create).toHaveBeenCalledTimes(1);
    expect(everythingTraced()).not.toContain(marker);
  });

  it("logs ASSISTANT_TURN_COMPLETED with the outcome", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    const { akashMlClient, toolRunner, logger, run } = setup();
    akashMlClient.streamChatCompletion
      .mockImplementationOnce(streamed({ toolCalls: [toolCall("c1", "get_deployment", { dseq: "42" }), toolCall("c2", "get_bids", { dseq: "42" })] }))
      .mockImplementationOnce(streamed({ content: "Done." }));
    toolRunner.run
      .mockResolvedValueOnce({ kind: "result", content: "{}", summary: "Read deployment 42", ok: true })
      .mockResolvedValueOnce({ kind: "result", content: "{}", summary: "Could not read the bids", ok: false });

    await run({});

    expect(logger.info).toHaveBeenCalledWith({
      event: "ASSISTANT_TURN_COMPLETED",
      outcome: "answered",
      durationMs: 0,
      firstTokenMs: 0,
      model: "assistant-model",
      promptVersion: ASSISTANT_PROMPT_VERSION,
      toolCallCount: 2,
      failedToolCallCount: 1
    });
  });

  function setup(input: { streamsFromAkashMl?: boolean } = {}) {
    const akashMlClient = mock<AkashMlClient>();
    const akashMlHttpClient = mock<HttpClient>();
    const toolRunner = mock<AssistantToolRunnerService>();
    toolRunner.chatTools.mockImplementation(async ({ configureFormOpen }) =>
      assistantChatToolsFor({ configureFormOpen, consoleApiCatalog: "Projects: /v1/projects" })
    );
    const limitsService = mock<AssistantLimitsService>();
    const transcriptService = mock<AssistantTranscriptService>();
    const pendingTurnRepository = mock<AssistantPendingTurnRepository>();
    const traceRepository = mock<AssistantTurnTraceRepository>();
    traceRepository.start.mockResolvedValue("trace-1");
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const config = envSchema.parse({ ASSISTANT_MODEL: "assistant-model", AKASHML_API_KEY: "test-key", ASSISTANT_HISTORY_SIGNING_KEY: "k".repeat(32) });
    const signer = new AssistantAnswerSigner(config);
    const service = new AssistantTurnService(
      input.streamsFromAkashMl ? new AkashMlClient(akashMlHttpClient, config, createLogger) : akashMlClient,
      toolRunner,
      limitsService,
      transcriptService,
      pendingTurnRepository,
      traceRepository,
      signer,
      config,
      createLogger
    );

    async function run(turn: Partial<AssistantTurn>, signal = new AbortController().signal): Promise<AssistantStreamEvent[]> {
      const events: AssistantStreamEvent[] = [];
      await service.run(
        assistantTurn(turn),
        async event => {
          events.push(event);
        },
        signal
      );

      return events;
    }

    function everythingTraced(): string {
      const { start, appendCard, finish, create } = traceRepository;
      return JSON.stringify([start.mock.calls, appendCard.mock.calls, finish.mock.calls, create.mock.calls]);
    }

    return {
      service,
      akashMlClient,
      akashMlHttpClient,
      toolRunner,
      limitsService,
      transcriptService,
      pendingTurnRepository,
      traceRepository,
      signer,
      logger,
      everythingTraced,
      run
    };
  }
});
