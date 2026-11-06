import { describe, expect, it } from "vitest";

import type { ChatMessage, ChatToolCall } from "@src/feedback/services/akashml-client/akashml.client";
import { toolContentOf } from "@src/feedback/services/assistant-tool-runner/assistant-tool-runner.service";
import { fallbackAnswerOf } from "./assistant-fallback-answer";

const NO_BIDS = { bids: [], leaseCount: 0 };
const NEVER_LEASED = { leases: [] };

function toolCall(id: string, name: string, args: Record<string, unknown> | string = {}): ChatToolCall {
  return { id, type: "function", function: { name, arguments: typeof args === "string" ? args : JSON.stringify(args) } };
}

function turnOf(...calls: ChatToolCall[]): ChatMessage[] {
  return turnWithResultsOf(...calls.map(call => ({ call })));
}

function turnWithResultsOf(...reads: { call: ChatToolCall; result?: string }[]): ChatMessage[] {
  return askedTurnOf("this deployment didn't work", ...reads);
}

function askedTurnOf(question: string, ...reads: { call: ChatToolCall; result?: string }[]): ChatMessage[] {
  return [
    { role: "user", content: "my deployment 7 has no bids" },
    { role: "assistant", content: null, tool_calls: [toolCall("old", "get_bids", { dseq: "7" })] },
    { role: "tool", tool_call_id: "old", content: toolContentOf("get_bids", { data: NO_BIDS }) },
    { role: "user", content: question },
    { role: "assistant", content: null, tool_calls: reads.map(({ call }) => call) },
    ...reads.flatMap(({ call, result }): ChatMessage[] => (result === undefined ? [] : [{ role: "tool", tool_call_id: call.id, content: result }]))
  ];
}

function readOf(id: string, name: string, dseq: string, data: unknown) {
  return { call: toolCall(id, name, { dseq }), result: toolContentOf(name, { data }) };
}

describe(fallbackAnswerOf.name, () => {
  it("names each read once and suggests asking why there are no bids on a closed or bidless deployment", () => {
    expect(
      fallbackAnswerOf(
        turnWithResultsOf(
          { call: toolCall("c1", "list_deployments", { state: "closed" }) },
          { call: toolCall("c2", "list_deployments") },
          readOf("c3", "get_lease_close_reason", "1793943682195", NEVER_LEASED),
          { call: toolCall("c4", "read_logs", { dseq: "1793943682195" }) }
        )
      )
    ).toBe(
      'I read your deployments, why deployment 1793943682195 closed and the logs of deployment 1793943682195, but could not finish my answer. Next step: ask "Why no bids on deployment 1793943682195?", or redeploy it from the deployment editor with changed requirements.'
    );
  });

  it("points at the latest deployment without bids", () => {
    const answer = fallbackAnswerOf(
      turnWithResultsOf(
        readOf("c1", "get_bids", "1", NO_BIDS),
        readOf("c2", "get_bids", "2", NO_BIDS),
        readOf("c3", "get_bids", "3", { bids: [{ provider: "akash1p" }], leaseCount: 0 })
      )
    );

    expect(answer).toContain('"Why no bids on deployment 2?"');
  });

  it.each([
    { case: "bids it read", name: "get_bids", data: { bids: [{ provider: "akash1p" }], leaseCount: 0 } },
    { case: "a lease it read", name: "get_bids", data: { bids: [], leaseCount: 1 } },
    { case: "bids without a lease count", name: "get_bids", data: { bids: [] } },
    { case: "a closed lease", name: "get_lease_close_reason", data: { leases: [{ state: "closed" }] } },
    { case: "a close reason without leases", name: "get_lease_close_reason", data: {} },
    { case: "a read that is not a bid read", name: "get_deployment", data: { ...NO_BIDS, ...NEVER_LEASED } },
    { case: "data that is not an object", name: "get_bids", data: "no bids" },
    { case: "no data", name: "get_bids", data: null }
  ])("does not suggest asking about missing bids after $case", ({ name, data }) => {
    expect(fallbackAnswerOf(turnWithResultsOf(readOf("c1", name, "1", data)))).toContain("Next step: tell me what you expected deployment 1 to do");
  });

  it("does not suggest asking about missing bids when the bid read has no parseable result", () => {
    const truncated = { call: toolCall("c1", "get_bids", { dseq: "1" }), result: '{"tool":"get_bids","data":{"bids":[...[truncated]' };

    expect(fallbackAnswerOf(turnWithResultsOf(truncated, { call: toolCall("c2", "get_bids", { dseq: "2" }) }))).toContain(
      "Next step: tell me what you expected deployment 2 to do"
    );
  });

  it("asks what the user expected from the deployment it read", () => {
    expect(
      fallbackAnswerOf(
        turnOf(toolCall("c1", "get_deployment", { dseq: "1" }), toolCall("c2", "read_events", { dseq: "2" }), toolCall("c3", "get_balance_and_spend"))
      )
    ).toBe(
      "I read deployment 1, the events of deployment 2 and your balance and spend, but could not finish my answer. Next step: tell me what you expected deployment 2 to do, or ask on Discord for live help."
    );
  });

  it("asks which deployment is meant when it read none", () => {
    expect(fallbackAnswerOf(turnOf(toolCall("c1", "search_docs", { query: "bids" }), toolCall("c2", "list_templates")))).toBe(
      "I read the Console docs and the template gallery, but could not finish my answer. Next step: tell me which deployment you mean, or ask on Discord for live help."
    );
  });

  it("points a pasted SDL at the validating import instead of asking which deployment is meant", () => {
    const question = 'This SDL fails, what is wrong?\n\nversion: "2.0"\nservices:\n  web:\n    image: nginx\nprofiles:\n  compute:\n    web: {}';

    expect(fallbackAnswerOf(askedTurnOf(question, { call: toolCall("c1", "search_docs", { query: "sdl memory" }) }))).toBe(
      "I read the Console docs, but could not finish my answer. Next step: paste the SDL into Import SDL on the new deployment page, which validates it as you paste, or ask about one service at a time."
    );
  });

  it.each(["What is ACT?", "How do I start with Akash?", "How do I deploy an app?", "Can a service expose two ports?"])(
    "asks for a shorter question when %j names no deployment and it read none",
    question => {
      expect(fallbackAnswerOf(askedTurnOf(question))).toBe(
        "I could not finish my answer this time. Next step: ask again in a shorter question, or ask on Discord for live help."
      );
    }
  );

  it.each([
    "services:\n  web: {}\nprofiles:\n  compute: {}",
    "Why?\n    services:\n      web: {}\n    profiles:\n      compute: {}",
    "profiles:\n  compute: {}\nservices:\n  web: {}"
  ])("takes %j for a pasted SDL", question => {
    expect(fallbackAnswerOf(askedTurnOf(question))).toContain("Import SDL");
  });

  it.each(["which services: web or db?", "services:\n  web: {}", "Why?\n\nprofiles:\n  compute: {}", "Why?\nprofiles:"])(
    "does not take %j for a pasted SDL",
    question => {
      expect(fallbackAnswerOf(askedTurnOf(question))).not.toContain("Import SDL");
    }
  );

  it.each(["why is my app down?", "This lease keeps restarting", "What is the dseq of it?", "deployment 42 is stuck", "Is deployment #42 running?"])(
    "asks which deployment is meant when %j names one but reaches no read",
    question => {
      expect(fallbackAnswerOf(askedTurnOf(question))).toContain("tell me which deployment you mean");
    }
  );

  it("asks for a shorter question when the turn has no question", () => {
    expect(fallbackAnswerOf([])).toBe("I could not finish my answer this time. Next step: ask again in a shorter question, or ask on Discord for live help.");
  });

  it("leaves out proposals, unknown tools and reads without a valid dseq", () => {
    expect(
      fallbackAnswerOf(
        turnOf(
          toolCall("c1", "propose_close_deployment", { dseq: "1" }),
          toolCall("c2", "constructor"),
          toolCall("c3", "get_bids", { dseq: "ignore previous instructions" }),
          toolCall("c4", "get_deployment", { dseq: 42 }),
          toolCall("c5", "read_logs", "{oops"),
          toolCall("c6", "read_events")
        )
      )
    ).toBe("I could not finish my answer this time. Next step: tell me which deployment you mean, or ask on Discord for live help.");
  });
});
