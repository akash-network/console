import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { AssistantTurnTraceBuilder, traceResultOf, writeTraceQuietly } from "./assistant-turn-trace";

const STARTED_AT = new Date("2026-11-08T12:00:00.000Z");

function afterStart(ms: number) {
  return new Date(STARTED_AT.getTime() + ms);
}

describe(AssistantTurnTraceBuilder.name, () => {
  it("carries the turn facts it started with and finishes with the outcome", () => {
    const { builder } = setup({ organizationId: "org-1", page: "/deployments" });

    expect(builder.finish("answered", afterStart(0))).toEqual({
      conversationId: "conversation-1",
      userId: "user-1",
      organizationId: "org-1",
      page: "/deployments",
      model: "model-1",
      promptVersion: "abcdef123456",
      outcome: "answered",
      startedAt: STARTED_AT,
      firstTokenMs: null,
      durationMs: 0,
      promptTokens: 0,
      completionTokens: 0,
      toolCalls: [],
      cards: []
    });
  });

  it("starts as a running trace with nothing counted yet, whatever happened since", () => {
    const { builder } = setup({ organizationId: "org-1", page: "/deployments" });
    builder.textShown(afterStart(100));
    builder.usageAdded({ promptTokens: 10, completionTokens: 5 });
    builder.toolFinished({ name: "list_deployments", ok: true, durationMs: 40 });
    builder.cardProposed({ proposalId: "proposal-1", actionType: "close_deployment" });

    expect(builder.running()).toEqual({
      conversationId: "conversation-1",
      userId: "user-1",
      organizationId: "org-1",
      page: "/deployments",
      model: "model-1",
      promptVersion: "abcdef123456",
      outcome: "running",
      startedAt: STARTED_AT,
      firstTokenMs: null,
      durationMs: 0,
      promptTokens: 0,
      completionTokens: 0,
      toolCalls: [],
      cards: []
    });
  });

  it("records time to the first shown text only once", () => {
    const { builder } = setup({});

    builder.textShown(afterStart(1200));
    builder.textShown(afterStart(5000));

    expect(builder.finish("answered", afterStart(6000)).firstTokenMs).toBe(1200);
  });

  it("leaves first token empty when no text was shown", () => {
    const { builder } = setup({});

    expect(builder.finish("failed", afterStart(300)).firstTokenMs).toBeNull();
  });

  it("sums token usage across completions and ignores missing usage", () => {
    const { builder } = setup({});

    builder.usageAdded({ promptTokens: 10, completionTokens: 5 });
    builder.usageAdded(null);
    builder.usageAdded({ promptTokens: 3, completionTokens: 2 });

    expect(builder.finish("answered", afterStart(100))).toMatchObject({ promptTokens: 13, completionTokens: 7 });
  });

  it("keeps tool calls and cards in the order they happened", () => {
    const { builder } = setup({});

    builder.toolFinished({ name: "list_deployments", ok: true, durationMs: 40 });
    builder.cardProposed({ proposalId: "proposal-1", actionType: "close_deployment" });
    builder.toolFinished({ name: "get_logs", ok: false, durationMs: 900 });
    builder.cardProposed({ proposalId: "proposal-2", actionType: "redeploy" });

    expect(builder.finish("answered", afterStart(2000))).toMatchObject({
      toolCalls: [
        { name: "list_deployments", ok: true, durationMs: 40 },
        { name: "get_logs", ok: false, durationMs: 900 }
      ],
      cards: [
        { proposalId: "proposal-1", actionType: "close_deployment", decision: null },
        { proposalId: "proposal-2", actionType: "redeploy", decision: null }
      ]
    });
  });

  it("keeps only the traced fields of a tool call and a card", () => {
    const { builder } = setup({});
    const failedCall = { name: "get_logs", ok: false, durationMs: 900, error: "secret value in the reason" };
    const card = { proposalId: "proposal-1", actionType: "set_secret", value: "hunter2" };

    builder.toolFinished(failedCall);
    builder.cardProposed(card);
    const trace = builder.finish("answered", afterStart(1000));

    expect(trace.toolCalls).toStrictEqual([{ name: "get_logs", ok: false, durationMs: 900 }]);
    expect(trace.cards).toStrictEqual([{ proposalId: "proposal-1", actionType: "set_secret", decision: null }]);
  });

  it("computes duration from start to finish", () => {
    const { builder } = setup({});

    expect(builder.finish("timed_out", afterStart(45_250)).durationMs).toBe(45_250);
  });

  it("gives the result of a finished turn without its start facts or cards", () => {
    const { builder } = setup({});
    builder.textShown(afterStart(200));
    builder.usageAdded({ promptTokens: 10, completionTokens: 5 });
    builder.toolFinished({ name: "list_deployments", ok: false, durationMs: 40 });
    builder.cardProposed({ proposalId: "proposal-1", actionType: "close_deployment" });

    expect(traceResultOf(builder.finish("answered", afterStart(900)))).toStrictEqual({
      outcome: "answered",
      firstTokenMs: 200,
      durationMs: 900,
      promptTokens: 10,
      completionTokens: 5,
      toolCalls: [{ name: "list_deployments", ok: false, durationMs: 40 }]
    });
  });

  function setup(input: { organizationId?: string | null; page?: string | null }) {
    const builder = new AssistantTurnTraceBuilder({
      conversationId: "conversation-1",
      userId: "user-1",
      organizationId: input.organizationId ?? null,
      page: input.page ?? null,
      model: "model-1",
      promptVersion: "abcdef123456",
      startedAt: STARTED_AT
    });

    return { builder };
  }
});

describe(writeTraceQuietly.name, () => {
  it("writes the trace, returns what the write returned and logs nothing when the write succeeds", async () => {
    const { logger, write } = setup();
    write.mockResolvedValue("trace-1");

    await expect(writeTraceQuietly(logger, write)).resolves.toBe("trace-1");

    expect(write).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("logs ASSISTANT_TURN_TRACE_FAILED instead of throwing when the write fails", async () => {
    const { logger, write } = setup();
    const error = new Error("db down");
    write.mockRejectedValue(error);

    await expect(writeTraceQuietly(logger, write)).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith({ event: "ASSISTANT_TURN_TRACE_FAILED", error });
  });

  function setup() {
    const logger = mock<ReturnType<CreateLogger>>();
    const write = vi.fn<() => Promise<unknown>>().mockResolvedValue(undefined);

    return { logger, write };
  }
});
