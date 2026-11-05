import { describe, expect, it, vi } from "vitest";

import type { AssistantClientToolRequest, AssistantClientToolResult, AssistantStreamEvent } from "@src/types/assistant";
import { runAssistantTurn } from "./runAssistantTurn";

describe(runAssistantTurn.name, () => {
  it("passes every event on and ends with the reason the turn finished", async () => {
    const events: AssistantStreamEvent[] = [
      { type: "text_delta", text: "Hi" },
      { type: "done", reason: "length" }
    ];
    const { end, onEvent, resume } = await setup({ streams: [events] });

    expect(end).toEqual({ kind: "done", reason: "length" });
    expect(onEvent.mock.calls.map(([event]) => event)).toEqual(events);
    expect(resume).not.toHaveBeenCalled();
  });

  it("ends with the error the stream reports", async () => {
    const { end } = await setup({ streams: [[{ type: "error", code: "assistant_unavailable", message: "Over budget" }]] });

    expect(end).toEqual({ kind: "error", code: "assistant_unavailable", message: "Over budget" });
  });

  it("reports a stream that stops without done or error as cut short", async () => {
    const { end } = await setup({ streams: [[{ type: "text_delta", text: "Partial" }]] });

    expect(end).toEqual({ kind: "error", code: "assistant_error", message: "The answer stopped before it finished." });
  });

  it("stops reading at the event that ends the turn", async () => {
    const { onEvent } = await setup({
      streams: [
        [
          { type: "done", reason: "stop" },
          { type: "text_delta", text: "Never shown" }
        ]
      ]
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it("answers every browser tool the turn paused on and follows the resumed stream", async () => {
    const logs = toolRequest("t-logs", "read_logs");
    const events = toolRequest("t-events", "read_events");
    const { end, resume, runClientTool, onEvent } = await setup({
      streams: [
        [logs, events, { type: "done", reason: "awaiting_client_tool" }],
        [
          { type: "text_delta", text: "Your container is out of memory." },
          { type: "done", reason: "stop" }
        ]
      ]
    });

    expect(runClientTool.mock.calls.map(([request]) => request)).toEqual([logs, events]);
    expect(resume).toHaveBeenCalledWith([resultOf(logs), resultOf(events)]);
    expect(onEvent).toHaveBeenLastCalledWith({ type: "done", reason: "stop" });
    expect(end).toEqual({ kind: "done", reason: "stop" });
  });

  it("answers only the requests of the latest pause when the turn pauses twice", async () => {
    const first = toolRequest("t-1", "read_events");
    const second = toolRequest("t-2", "read_logs");
    const { resume } = await setup({
      streams: [
        [first, { type: "done", reason: "awaiting_client_tool" }],
        [second, { type: "done", reason: "awaiting_client_tool" }],
        [{ type: "done", reason: "stop" }]
      ]
    });

    expect(resume.mock.calls).toEqual([[[resultOf(first)]], [[resultOf(second)]]]);
  });

  it("reports a pause without any tool request as cut short instead of waiting forever", async () => {
    const { end, resume } = await setup({ streams: [[{ type: "done", reason: "awaiting_client_tool" }]] });

    expect(end).toEqual(expect.objectContaining({ kind: "error", code: "assistant_error" }));
    expect(resume).not.toHaveBeenCalled();
  });

  function toolRequest(toolCallId: string, name: AssistantClientToolRequest["name"]): AssistantClientToolRequest {
    return { type: "client_tool_request", toolCallId, name, arguments: { dseq: "42" }, maxLength: 1000 };
  }

  function resultOf(request: AssistantClientToolRequest): AssistantClientToolResult {
    return { toolCallId: request.toolCallId, content: `${request.name} output`, ok: true };
  }

  async function setup(input: { streams: AssistantStreamEvent[][] }) {
    const [first, ...resumed] = input.streams.map(events => streamOf(events));
    const resume = vi.fn((results: AssistantClientToolResult[]) => {
      void results;
      return resumed.shift()!;
    });
    const runClientTool = vi.fn(async (request: AssistantClientToolRequest) => resultOf(request));
    const onEvent = vi.fn();

    const end = await runAssistantTurn({ events: first, resume, runClientTool, onEvent });

    return { end, resume, runClientTool, onEvent };
  }

  async function* streamOf(events: AssistantStreamEvent[]) {
    yield* events;
  }
});
