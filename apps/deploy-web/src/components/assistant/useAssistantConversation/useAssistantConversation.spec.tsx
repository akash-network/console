import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AssistantConversationClient } from "@src/services/assistant-conversation/assistant-conversation-client";
import type { AssistantClientToolRequest, AssistantStreamEvent } from "@src/types/assistant";
import { ASSISTANT_CONSENT_COPY_VERSION } from "../assistantConsentCopy";
import { DEPENDENCIES, problemOfError, problemOfStreamError, useAssistantConversation } from "./useAssistantConversation";

import { act, renderHook, waitFor } from "@testing-library/react";

type Container = ReturnType<typeof DEPENDENCIES.useServices>;

describe(useAssistantConversation.name, () => {
  it("starts a conversation with the current consent version and context, then streams the answer", async () => {
    const { result, startConversation, assistantConversation } = setup({ turns: [answerOf("Your lease is active.")] });

    await act(() => result.current.send("  Is my app up?  "));

    expect(startConversation).toHaveBeenCalledWith({ data: { copyVersion: ASSISTANT_CONSENT_COPY_VERSION, context: { page: "/deployments/42", dseq: "42" } } });
    expect(assistantConversation.sendMessage).toHaveBeenCalledWith(
      "c-1",
      { data: { content: "Is my app up?", history: [], context: { page: "/deployments/42", dseq: "42" } } },
      expect.any(AbortSignal)
    );
    expect(result.current.messages.map(({ role, text }) => ({ role, text }))).toEqual([
      { role: "user", text: "Is my app up?" },
      { role: "assistant", text: "Your lease is active." }
    ]);
    expect(result.current.conversationId).toBe("c-1");
    expect(result.current.isAnswering).toBe(false);
  });

  it("resends the earlier messages of a conversation the api does not store and reuses the conversation", async () => {
    const { result, startConversation, assistantConversation } = setup({ turns: [answerOf("First answer"), answerOf("Second answer")] });

    await act(() => result.current.send("First question"));
    await act(() => result.current.send("Second question"));

    expect(startConversation).toHaveBeenCalledTimes(1);
    expect(assistantConversation.sendMessage).toHaveBeenLastCalledWith(
      "c-1",
      expect.objectContaining({
        data: expect.objectContaining({
          history: [
            { role: "user", content: "First question" },
            { role: "assistant", content: "First answer" }
          ]
        })
      }),
      expect.any(AbortSignal)
    );
  });

  it("sends no history for a conversation the api stores", async () => {
    const { result, assistantConversation } = setup({ stored: true, turns: [answerOf("One"), answerOf("Two")] });

    await act(() => result.current.send("First"));
    await act(() => result.current.send("Second"));

    expect(assistantConversation.sendMessage.mock.lastCall?.[1].data.history).toBeUndefined();
    expect(result.current.isStored).toBe(true);
  });

  it("reads logs in the browser when the turn pauses, and shows the rest of the answer", async () => {
    const toolRequest: AssistantClientToolRequest = {
      type: "client_tool_request",
      toolCallId: "t-1",
      name: "read_logs",
      arguments: { dseq: "42", service: "web" },
      maxLength: 16000
    };
    const { result, runClientTool, assistantConversation } = setup({
      turns: [[toolRequest, { type: "done", reason: "awaiting_client_tool" }]],
      resumed: [answerOf("It ran out of memory.")]
    });

    await act(() => result.current.send("Why does it restart?"));

    expect(runClientTool).toHaveBeenCalledWith(toolRequest);
    expect(assistantConversation.submitClientToolResults).toHaveBeenCalledWith(
      "c-1",
      { data: { results: [{ toolCallId: "t-1", ok: true, content: "logs" }] } },
      expect.any(AbortSignal)
    );
    expect(result.current.messages[1]).toEqual(
      expect.objectContaining({ text: "It ran out of memory.", reads: [{ id: "t-1", label: "logs (web, last 200 lines)", ok: true }] })
    );
  });

  it("shows the problem a refused start reports", async () => {
    const { result } = setup({ startError: new ApiError(409, { code: "assistant_consent_outdated" }, "refused") });

    await act(() => result.current.send("Hi"));

    expect(result.current.problem).toBe("consent");
    expect(result.current.isAnswering).toBe(false);
  });

  it("shows the problem a stream ends with", async () => {
    const { result } = setup({ turns: [[{ type: "error", code: "assistant_unavailable", message: "Over budget" }]] });

    await act(() => result.current.send("Hi"));

    expect(result.current.problem).toBe("unavailable");
  });

  it("starts a new conversation once when the api says the current one ended", async () => {
    const { result, startConversation, assistantConversation } = setup({ turns: [answerOf("Back again")] });
    assistantConversation.sendMessage.mockImplementationOnce(() => failingStream(new ApiError(409, { code: "assistant_conversation_ended" }, "ended")));

    await act(() => result.current.send("Hello"));

    expect(startConversation).toHaveBeenCalledTimes(2);
    expect(result.current.messages[1].text).toBe("Back again");
    expect(result.current.problem).toBeNull();
  });

  it("gives up after one restart", async () => {
    const { result, startConversation, assistantConversation } = setup({});
    assistantConversation.sendMessage.mockImplementation(() => failingStream(new ApiError(409, { code: "assistant_conversation_ended" }, "ended")));

    await act(() => result.current.send("Hello"));

    expect(startConversation).toHaveBeenCalledTimes(2);
    expect(result.current.problem).toBe("error");
  });

  it("ignores an empty message and a message sent while answering", async () => {
    const { result, assistantConversation } = setup({});
    const pending = Promise.withResolvers<void>();
    assistantConversation.sendMessage.mockImplementation(() => blockedStream(pending.promise));

    await act(() => result.current.send("   "));
    act(() => void result.current.send("First"));
    await waitFor(() => expect(result.current.isAnswering).toBe(true));
    await act(() => result.current.send("Second"));

    expect(assistantConversation.sendMessage).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve());
  });

  it("ends the conversation with whether it helped and forgets it", async () => {
    const { result, endConversation, startConversation } = setup({ turns: [answerOf("Done"), answerOf("New")] });
    await act(() => result.current.send("Question"));

    await act(() => result.current.end(true));

    expect(endConversation).toHaveBeenCalledWith({ id: "c-1", data: { resolvedByUser: true } });
    expect(result.current.endedAs).toBe("resolved");
    expect(result.current.conversationId).toBeNull();

    await act(() => result.current.send("Another question"));
    expect(startConversation).toHaveBeenCalledTimes(2);
    expect(result.current.endedAs).toBeNull();
  });

  it("marks a conversation that did not help as unresolved even when ending it fails", async () => {
    const { result, endConversation } = setup({ turns: [answerOf("Done")] });
    endConversation.mockRejectedValue(new Error("offline"));
    await act(() => result.current.send("Question"));

    await act(() => result.current.end(false));

    expect(result.current.endedAs).toBe("unresolved");
  });

  it("only marks the end when no conversation was started", async () => {
    const { result, endConversation } = setup({});

    await act(() => result.current.end(false));

    expect(endConversation).not.toHaveBeenCalled();
    expect(result.current.endedAs).toBe("unresolved");
  });

  it("starts over with an empty conversation", async () => {
    const { result, startConversation } = setup({ turns: [[{ type: "error", code: "assistant_error", message: "x" }], answerOf("Fresh")] });
    await act(() => result.current.send("Question"));

    act(() => result.current.startOver());

    expect(result.current.messages).toEqual([]);
    expect(result.current.problem).toBeNull();
    expect(result.current.conversationId).toBeNull();
    await act(() => result.current.send("Again"));
    expect(startConversation).toHaveBeenCalledTimes(2);
  });

  it("clears a problem on request", async () => {
    const { result } = setup({ startError: new ApiError(429, { code: "assistant_rate_limited" }, "slow") });
    await act(() => result.current.send("Hi"));

    act(() => result.current.clearProblem());

    expect(result.current.problem).toBeNull();
  });

  it("stops the answer on unmount without reporting a problem", async () => {
    const { result, unmount, assistantConversation } = setup({});
    let signal: AbortSignal | undefined;
    assistantConversation.sendMessage.mockImplementation((_id, _body, abortSignal) => {
      signal = abortSignal;
      return failingStreamOnAbort(abortSignal!);
    });

    act(() => void result.current.send("Hi"));
    await waitFor(() => expect(signal).toBeDefined());
    unmount();

    expect(signal?.aborted).toBe(true);
  });

  describe(problemOfError.name, () => {
    it("maps each refusal to the problem the panel shows", () => {
      expect(problemOfError(new ApiError(409, { code: "assistant_consent_required" }, "x"))).toBe("consent");
      expect(problemOfError(new ApiError(429, { code: "assistant_rate_limited" }, "x"))).toBe("rate_limited");
      expect(problemOfError(new ApiError(429, { code: "assistant_daily_limit" }, "x"))).toBe("daily_limit");
      expect(problemOfError(new ApiError(503, { code: "assistant_unavailable" }, "x"))).toBe("unavailable");
      expect(problemOfError(new ApiError(503, "Service Unavailable", "x"))).toBe("unavailable");
      expect(problemOfError(new ApiError(500, { code: "internal" }, "x"))).toBe("error");
      expect(problemOfError(new Error("network"))).toBe("error");
    });
  });

  describe(problemOfStreamError.name, () => {
    it("tells an unavailable assistant apart from a failed answer", () => {
      expect(problemOfStreamError("assistant_unavailable")).toBe("unavailable");
      expect(problemOfStreamError("assistant_timeout")).toBe("error");
    });
  });

  function answerOf(text: string): AssistantStreamEvent[] {
    return [
      { type: "text_delta", text },
      { type: "done", reason: "stop" }
    ];
  }

  async function* streamOf(events: AssistantStreamEvent[]): AsyncGenerator<AssistantStreamEvent> {
    yield* events;
  }

  async function* failingStream(error: unknown): AsyncGenerator<AssistantStreamEvent> {
    await Promise.reject(error);
    yield { type: "done", reason: "stop" };
  }

  async function* blockedStream(until: Promise<void>): AsyncGenerator<AssistantStreamEvent> {
    await until;
    yield { type: "done", reason: "stop" };
  }

  async function* failingStreamOnAbort(signal: AbortSignal): AsyncGenerator<AssistantStreamEvent> {
    await new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
    yield { type: "done", reason: "stop" };
  }

  function setup(input: { turns?: AssistantStreamEvent[][]; resumed?: AssistantStreamEvent[][]; stored?: boolean; startError?: unknown }) {
    const turns = [...(input.turns ?? [])];
    const resumed = [...(input.resumed ?? [])];
    const assistantConversation = mock<AssistantConversationClient>();
    assistantConversation.sendMessage.mockImplementation(() => streamOf(turns.shift() ?? []));
    assistantConversation.submitClientToolResults.mockImplementation(() => streamOf(resumed.shift() ?? []));
    let conversationCount = 0;
    const startConversation = vi.fn(async () => {
      if (input.startError) throw input.startError;
      return { data: { id: `c-${++conversationCount}`, stored: input.stored ?? false } };
    });
    const endConversation = vi.fn(async () => ({ data: { id: "c-1", status: "resolved" as const } }));
    const runClientTool = vi.fn(async (request: AssistantClientToolRequest) => ({ toolCallId: request.toolCallId, ok: true, content: "logs" }));
    const container = Object.assign(mock<Container>(), { assistantConversation });
    const dependencies: typeof DEPENDENCIES = {
      ...DEPENDENCIES,
      useServices: () => container,
      useAssistantClientTools: () => runClientTool,
      useStartAssistantConversationMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useStartAssistantConversationMutation>>({ mutateAsync: startConversation as never }),
      useEndAssistantConversationMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useEndAssistantConversationMutation>>({ mutateAsync: endConversation as never })
    };

    const hook = renderHook(() => useAssistantConversation({ context: { page: "/deployments/42", dseq: "42" } }, dependencies));

    return { ...hook, assistantConversation, startConversation, endConversation, runClientTool };
  }
});
