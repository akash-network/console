import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AssistantConversationClient } from "@src/services/assistant-conversation/assistant-conversation-client";
import type { AssistantClientToolRequest, AssistantContext, AssistantStreamEvent } from "@src/types/assistant";
import { ASSISTANT_CONSENT_COPY_VERSION } from "../assistantConsentCopy";
import { ASSISTANT_REPORT_CONSENT_COPY_VERSION } from "../assistantReportConsentCopy";
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

  it("marks the question when the api says it removed a secret from it, and knows the deployment in view", async () => {
    const { result } = setup({ turns: [[{ type: "secret_redacted", count: 1 }, ...answerOf("Use a secret instead.")]] });

    await act(() => result.current.send("my token is hf_abc"));

    expect(result.current.messages.map(({ role, text, redactedSecretCount }) => ({ role, text, redactedSecretCount }))).toEqual([
      { role: "user", text: "my token is hf_abc", redactedSecretCount: 1 },
      { role: "assistant", text: "Use a secret instead.", redactedSecretCount: 0 }
    ]);
    expect(result.current.deploymentDseq).toBe("42");
  });

  it("knows no deployment outside a deployment page", () => {
    const { result } = setup({ context: { page: "/templates" } });

    expect(result.current.page).toBe("/templates");
    expect(result.current.deploymentDseq).toBeNull();
  });

  it("knows no page when the context has none", () => {
    const { result } = setup({ context: {} });

    expect(result.current.page).toBeNull();
  });

  it("resends the earlier messages of a conversation the api does not store and reuses the conversation", async () => {
    const { result, startConversation, assistantConversation } = setup({ turns: [answerOf("First answer", "sig-1"), answerOf("Second answer")] });

    await act(() => result.current.send("First question"));
    await act(() => result.current.send("Second question"));

    expect(startConversation).toHaveBeenCalledTimes(1);
    expect(assistantConversation.sendMessage).toHaveBeenLastCalledWith(
      "c-1",
      expect.objectContaining({
        data: expect.objectContaining({
          history: [
            { role: "user", content: "First question" },
            { role: "assistant", content: "First answer", signature: "sig-1" }
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
      expect.objectContaining({ text: "It ran out of memory.", reads: [{ id: "t-1", tool: "read_logs", label: "Read logs (web, last 200 lines)", ok: true }] })
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

  it("stays blocked after starting over when the api turned the assistant off for the account", async () => {
    const { result, assistantConversation } = setup({});
    assistantConversation.sendMessage.mockImplementationOnce(() => failingStream(new ApiError(403, { code: "assistant_blocked" }, "blocked")));
    await act(() => result.current.send("Question"));
    expect(result.current.problem).toBe("blocked");

    act(() => result.current.startOver());

    expect(result.current.messages).toEqual([]);
    expect(result.current.problem).toBe("blocked");
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

  describe("rate", () => {
    it("shows the rating of an answer at once and saves it on the answer's turn", async () => {
      const { result, rateTurn } = setup({ turns: [answerOf("Your lease is active.", "sig-1", "turn-1")] });
      await act(() => result.current.send("Is my app up?"));
      const answerId = result.current.messages[1].id;

      await act(() => result.current.rate(answerId, "down"));

      expect(rateTurn).toHaveBeenCalledWith({ id: "c-1", turnId: "turn-1", data: { rating: "down" } });
      expect(result.current.messages[1].rating).toBe("down");
    });

    it("puts the earlier rating back when the api refuses the new one", async () => {
      const { result, rateTurn } = setup({ turns: [answerOf("Your lease is active.", "sig-1", "turn-1")] });
      await act(() => result.current.send("Is my app up?"));
      const answerId = result.current.messages[1].id;
      await act(() => result.current.rate(answerId, "up"));
      rateTurn.mockRejectedValueOnce(new ApiError(500, "error", "x"));

      await act(() => result.current.rate(answerId, null));

      expect(result.current.messages[1].rating).toBe("up");
    });

    it("marks the answer as being rated until the api answers", async () => {
      const { result, rateTurn } = setup({ turns: [answerOf("Your lease is active.", "sig-1", "turn-1")] });
      await act(() => result.current.send("Is my app up?"));
      let accept: () => void = () => undefined;
      rateTurn.mockImplementationOnce(() => new Promise(resolve => (accept = () => resolve({ data: { turnId: "turn-1", rating: null } }))));

      let rating: Promise<void> = Promise.resolve();
      act(() => {
        rating = result.current.rate(result.current.messages[1].id, "up");
      });

      expect(result.current.messages[1]).toMatchObject({ rating: "up", isRating: true });
      await act(async () => {
        accept();
        await rating;
      });
      expect(result.current.messages[1]).toMatchObject({ rating: "up", isRating: false });
    });

    it("ignores another rating of the same answer until the first one settles, so a refusal cannot undo a later rating", async () => {
      const { result, rateTurn } = setup({ turns: [answerOf("Your lease is active.", "sig-1", "turn-1")] });
      await act(() => result.current.send("Is my app up?"));
      const answerId = result.current.messages[1].id;
      let refuse: () => void = () => undefined;
      rateTurn.mockImplementationOnce(() => new Promise((_, reject) => (refuse = () => reject(new ApiError(500, "error", "x")))));

      let first: Promise<void> = Promise.resolve();
      await act(async () => {
        first = result.current.rate(answerId, "up");
        await result.current.rate(answerId, "down");
      });
      await act(async () => {
        refuse();
        await first;
      });

      expect(rateTurn).toHaveBeenCalledTimes(1);
      expect(result.current.messages[1]).toMatchObject({ rating: null, isRating: false });

      await act(() => result.current.rate(answerId, "down"));

      expect(rateTurn).toHaveBeenCalledTimes(2);
      expect(result.current.messages[1].rating).toBe("down");
    });

    it("rates nothing for an answer the api gave no turn", async () => {
      const { result, rateTurn } = setup({ turns: [answerOf("Your lease is active.", "sig-1")] });
      await act(() => result.current.send("Is my app up?"));

      await act(() => result.current.rate(result.current.messages[1].id, "up"));
      await act(() => result.current.rate("missing", "up"));

      expect(rateTurn).not.toHaveBeenCalled();
      expect(result.current.messages[1].rating).toBeNull();
    });
  });

  describe("reportProblem", () => {
    it("sends the note, the report consent version and the signed messages of the reported answer's conversation, then marks it reported", async () => {
      const { result, createProblemReport } = setup({ turns: [answerOf("First answer", "sig-1", "turn-1"), answerOf("Second answer", "sig-2", "turn-2")] });
      await act(() => result.current.send("First question"));
      await act(() => result.current.send("Second question"));

      await act(() => result.current.reportProblem(result.current.messages[1].id, "  It named the wrong GPU  "));

      expect(createProblemReport).toHaveBeenCalledWith({
        id: "c-1",
        data: {
          turnId: "turn-1",
          note: "It named the wrong GPU",
          copyVersion: ASSISTANT_REPORT_CONSENT_COPY_VERSION,
          history: [
            { role: "user", content: "First question" },
            { role: "assistant", content: "First answer", signature: "sig-1" },
            { role: "user", content: "Second question" },
            { role: "assistant", content: "Second answer", signature: "sig-2" }
          ]
        }
      });
      expect(result.current.messages.map(({ reported }) => reported)).toEqual([false, true, false, false]);
    });

    it("leaves the note out when the user wrote none, and the messages of an earlier conversation", async () => {
      const { result, createProblemReport, assistantConversation } = setup({
        turns: [answerOf("Old answer", "sig-1", "turn-1"), answerOf("New answer", "sig-2", "turn-2")]
      });
      await act(() => result.current.send("Old question"));
      assistantConversation.sendMessage.mockImplementationOnce(() => failingStream(new ApiError(409, { code: "assistant_conversation_ended" }, "ended")));
      await act(() => result.current.send("New question"));

      await act(() => result.current.reportProblem(result.current.messages[3].id, "   "));

      expect(createProblemReport).toHaveBeenCalledWith({
        id: "c-2",
        data: {
          turnId: "turn-2",
          note: undefined,
          copyVersion: ASSISTANT_REPORT_CONSENT_COPY_VERSION,
          history: [
            { role: "user", content: "New question" },
            { role: "assistant", content: "New answer", signature: "sig-2" }
          ]
        }
      });
    });

    it("leaves out an answer that never got a signature, which the api could not verify", async () => {
      const { result, createProblemReport, assistantConversation } = setup({ turns: [answerOf("Good answer", "sig-2", "turn-2")] });
      assistantConversation.sendMessage.mockImplementationOnce(() => streamOf([{ type: "text_delta", text: "Cut off" }]));
      await act(() => result.current.send("First question"));
      await act(() => result.current.send("Second question"));

      await act(() => result.current.reportProblem(result.current.messages[3].id, ""));

      expect(createProblemReport).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            history: [
              { role: "user", content: "First question" },
              { role: "user", content: "Second question" },
              { role: "assistant", content: "Good answer", signature: "sig-2" }
            ]
          })
        })
      );
    });

    it("passes a refusal on to the caller and leaves the answer unreported", async () => {
      const error = new ApiError(429, { code: "assistant_report_limit" }, "x");
      const { result } = setup({ turns: [answerOf("Your lease is active.", "sig-1", "turn-1")], reportError: error });
      await act(() => result.current.send("Is my app up?"));

      await expect(act(() => result.current.reportProblem(result.current.messages[1].id, ""))).rejects.toBe(error);

      expect(result.current.messages[1].reported).toBe(false);
    });

    it("reports nothing for an answer the api gave no turn", async () => {
      const { result, createProblemReport } = setup({ turns: [answerOf("Your lease is active.")] });
      await act(() => result.current.send("Is my app up?"));

      await act(() => result.current.reportProblem(result.current.messages[1].id, "wrong"));

      expect(createProblemReport).not.toHaveBeenCalled();
    });
  });

  describe(problemOfError.name, () => {
    it("maps each refusal to the problem the panel shows", () => {
      expect(problemOfError(new ApiError(409, { code: "assistant_consent_required" }, "x"))).toBe("consent");
      expect(problemOfError(new ApiError(429, { code: "assistant_rate_limited" }, "x"))).toBe("rate_limited");
      expect(problemOfError(new ApiError(429, { code: "assistant_daily_limit" }, "x"))).toBe("daily_limit");
      expect(problemOfError(new ApiError(403, { code: "assistant_blocked" }, "x"))).toBe("blocked");
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

  function answerOf(text: string, answerSignature?: string, turnId?: string): AssistantStreamEvent[] {
    return [
      { type: "text_delta", text },
      { type: "done", reason: "stop", answerSignature, turnId }
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

  function setup(input: {
    turns?: AssistantStreamEvent[][];
    resumed?: AssistantStreamEvent[][];
    stored?: boolean;
    startError?: unknown;
    rateError?: unknown;
    reportError?: unknown;
    context?: AssistantContext;
  }) {
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
    const rateTurn = vi.fn(async () => {
      if (input.rateError) throw input.rateError;
      return { data: { turnId: "turn-1", rating: null } };
    });
    const createProblemReport = vi.fn(async () => {
      if (input.reportError) throw input.reportError;
      return { data: { id: "report-1" } };
    });
    const runClientTool = vi.fn(async (request: AssistantClientToolRequest) => ({ toolCallId: request.toolCallId, ok: true, content: "logs" }));
    const container = Object.assign(mock<Container>(), { assistantConversation });
    const dependencies: typeof DEPENDENCIES = {
      ...DEPENDENCIES,
      useServices: () => container,
      useAssistantClientTools: () => runClientTool,
      useStartAssistantConversationMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useStartAssistantConversationMutation>>({ mutateAsync: startConversation as never }),
      useEndAssistantConversationMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useEndAssistantConversationMutation>>({ mutateAsync: endConversation as never }),
      useRateAssistantTurnMutation: () => mock<ReturnType<typeof DEPENDENCIES.useRateAssistantTurnMutation>>({ mutateAsync: rateTurn as never }),
      useCreateAssistantProblemReportMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useCreateAssistantProblemReportMutation>>({ mutateAsync: createProblemReport as never })
    };

    const context = input.context ?? { page: "/deployments/42", dseq: "42" };
    const hook = renderHook(() => useAssistantConversation({ context }, dependencies));

    return { ...hook, assistantConversation, startConversation, endConversation, rateTurn, createProblemReport, runClientTool };
  }
});
