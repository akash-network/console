import { describe, expect, it } from "vitest";

import { scoreScenario, type TurnRecord, turnRecordOf } from "./assistant-lab-scoring";
import type { RecordedRequest } from "./assistant-turn-recorder";

describe(turnRecordOf.name, () => {
  it("reads the answer, tool calls, proposals and timings from the streamed events", () => {
    const requests: RecordedRequest[] = [
      {
        url: "/messages",
        startedAt: 1_000,
        endedAt: 4_000,
        status: 200,
        events: [
          { at: 1_500, event: { type: "tool_started", toolCallId: "a", name: "get_deployment" } },
          { at: 1_600, event: { type: "tool_result_summary", toolCallId: "a", name: "get_deployment", ok: true, summary: "Read deployment 1" } },
          { at: 2_000, event: { type: "text_delta", text: " " } },
          { at: 2_500, event: { type: "text_delta", text: "Update the " } },
          { at: 2_600, event: { type: "text_delta", text: "image." } },
          { at: 2_700, event: { type: "action_proposal", proposalId: "p", action: { type: "update_deployment", dseq: "1" } } },
          { at: 2_800, event: { type: "live_help_suggested", reason: "no_confident_answer" } },
          { at: 3_900, event: { type: "done", reason: "stop" } }
        ]
      }
    ];

    expect(turnRecordOf("fix it", 1_000, requests, false)).toEqual({
      said: "fix it",
      ttftMs: 1_500,
      totalMs: 3_000,
      toolCalls: [{ name: "get_deployment", summary: "Read deployment 1", ok: true }],
      proposals: [{ type: "update_deployment", action: { type: "update_deployment", dseq: "1" } }],
      liveHelp: true,
      text: " Update the image.",
      doneReason: "stop",
      error: null,
      httpStatus: 200,
      timedOut: false
    });
  });

  it("reports a stream error code and a tool whose result never arrived", () => {
    const requests: RecordedRequest[] = [
      {
        url: "/messages",
        startedAt: 10,
        endedAt: 20,
        status: 200,
        events: [
          { at: 12, event: { type: "tool_started", toolCallId: "a", name: "read_logs" } },
          { at: 15, event: { type: "error", code: "assistant_timeout", message: "slow" } }
        ]
      }
    ];

    const turn = turnRecordOf("logs", 10, requests, true);

    expect(turn).toMatchObject({ ttftMs: null, error: "assistant_timeout", doneReason: null, timedOut: true });
    expect(turn.toolCalls).toEqual([{ name: "read_logs", summary: null, ok: null }]);
  });

  it("reports a refused request by its status", () => {
    const requests: RecordedRequest[] = [{ url: "/messages", startedAt: 10, endedAt: 11, status: 429, events: [] }];

    expect(turnRecordOf("hi", 10, requests, false)).toMatchObject({ error: "http_429", httpStatus: 429, totalMs: 1 });
  });

  it("measures no time when nothing was sent", () => {
    expect(turnRecordOf("hi", 10, [], false)).toMatchObject({ totalMs: 0, httpStatus: null, error: null, text: "" });
  });
});

describe(scoreScenario.name, () => {
  it("resolves a scenario that meets every expectation with a card", () => {
    const score = scoreScenario(
      { calls: ["get_deployment"], proposes: ["update_deployment"], mentions: ["IMAGE"], neverMentions: ["escrow"] },
      [turn({ text: "Update the image.", toolCalls: [read("get_deployment")], proposals: [proposal("update_deployment")] })],
      { isOpen: true }
    );

    expect(score).toEqual({
      answered: true,
      correct: true,
      actionable: true,
      resolved: true,
      failures: [],
      uxIssues: [],
      toolCalls: 1,
      maxTtftMs: 800,
      totalMs: 5_000
    });
  });

  it("lists every unmet expectation", () => {
    const score = scoreScenario(
      {
        calls: ["get_bids"],
        neverCalls: ["list_deployments"],
        proposes: ["close_deployment"],
        proposesAnyOf: ["buy_credits", "redeem_coupon"],
        neverProposesTypes: ["update_deployment"],
        mentions: ["deadline"],
        mentionsAnyOf: ["redeploy", "move"],
        neverMentions: ["raise your price"],
        liveHelp: true,
        panelStaysOpen: true
      },
      [turn({ text: "Raise your price.", toolCalls: [read("list_deployments")], proposals: [proposal("update_deployment")] })],
      { isOpen: false }
    );

    expect(score.failures).toEqual([
      "did not call get_bids",
      "called list_deployments",
      "did not propose close_deployment",
      "proposed none of buy_credits/redeem_coupon",
      "proposed update_deployment",
      'never mentions "deadline"',
      "mentions none of redeploy/move",
      'says "raise your price"',
      "no live help card",
      "panel closed on navigation"
    ]);
    expect(score.resolved).toBe(false);
  });

  it("counts a mention found in a proposal's arguments", () => {
    const score = scoreScenario(
      { mentions: ["nginx:1.27"], mentionsAnyOf: ["blog-prod"] },
      [turn({ text: "", proposals: [{ type: "rename_deployment", action: { to: "blog-prod", image: "nginx:1.27" } }] })],
      { isOpen: true }
    );

    expect(score.failures).toEqual([]);
  });

  it("fails a scenario that proposed anything when it should not have, or left the panel open", () => {
    const score = scoreScenario({ neverProposes: true, panelClosed: true }, [turn({ proposals: [proposal("buy_credits")] })], { isOpen: true });

    expect(score.failures).toEqual(["proposed buy_credits", "panel still open"]);
  });

  it("treats a turn with only reads as unanswered and flags the ux issues", () => {
    const score = scoreScenario(
      {},
      [
        turn({
          text: "",
          ttftMs: null,
          totalMs: 50_000,
          doneReason: "length",
          toolCalls: [read("get_deployment", "Read deployment 1"), read("get_deployment", "Read deployment 1"), { name: "read_logs", summary: null, ok: false }]
        })
      ],
      { isOpen: true }
    );

    expect(score).toMatchObject({ answered: false, actionable: false, resolved: false, maxTtftMs: null });
    expect(score.uxIssues).toEqual(["empty_answer", "duplicate_reads", "failed_reads", "slow_turn", "cut_off"]);
  });

  it("flags errors, timeouts, slow first tokens, long answers and leaked tool names", () => {
    const score = scoreScenario(
      {},
      [turn({ text: `Call propose_close_deployment. ${"word ".repeat(260)}`, ttftMs: 12_000, error: "assistant_timeout", timedOut: true })],
      { isOpen: true }
    );

    expect(score.uxIssues).toEqual(["error", "timeout", "slow_first_token", "long_answer", "leaks_tool_names"]);
    expect(score.answered).toBe(false);
  });

  it("counts a live help card or a pointer to a page as an actionable answer", () => {
    expect(scoreScenario({}, [turn({ text: "Nothing to do.", liveHelp: true })], { isOpen: true }).actionable).toBe(true);
    expect(scoreScenario({}, [turn({ text: "Open the Billing page." })], { isOpen: true }).actionable).toBe(true);
    expect(scoreScenario({}, [turn({ text: "Nothing to do." })], { isOpen: true }).actionable).toBe(false);
    expect(scoreScenario({ panelClosed: true }, [turn({ text: "Hi." })], { isOpen: false }).actionable).toBe(true);
  });

  it("does not count repeated proposals as duplicate reads", () => {
    const score = scoreScenario({}, [turn({ toolCalls: [read("propose_rename_deployment"), read("propose_rename_deployment")] })], { isOpen: true });

    expect(score.uxIssues).toEqual([]);
  });

  it("scores no turns as unanswered", () => {
    expect(scoreScenario({}, [], { isOpen: true })).toMatchObject({ answered: true, actionable: false, toolCalls: 0, maxTtftMs: null, totalMs: 0 });
  });

  function read(name: string, summary = `Read ${name}`) {
    return { name, summary, ok: true };
  }

  function proposal(type: string) {
    return { type, action: { type } };
  }

  function turn(input: Partial<TurnRecord>): TurnRecord {
    return {
      said: "question",
      ttftMs: 800,
      totalMs: 5_000,
      toolCalls: [],
      proposals: [],
      liveHelp: false,
      text: "An answer.",
      doneReason: "stop",
      error: null,
      httpStatus: 200,
      timedOut: false,
      ...input
    };
  }
});
