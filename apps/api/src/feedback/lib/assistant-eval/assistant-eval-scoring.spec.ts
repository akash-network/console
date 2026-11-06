import { describe, expect, it } from "vitest";

import { assistantChatTools } from "@src/feedback/lib/assistant-tools/assistant-tools";
import { ASSISTANT_EVAL_CASES } from "./assistant-eval-cases";
import { formatAssistantEvalTable, scoreAssistantEval } from "./assistant-eval-scoring";

describe(scoreAssistantEval.name, () => {
  it("passes a transcript that meets every expectation", () => {
    const result = scoreAssistantEval(
      "update-image",
      {
        calls: ["get_deployment"],
        neverCalls: ["get_bids"],
        proposes: "update_deployment",
        proposalMentions: ["NGINX:1.27.0"],
        neverProposesTypes: ["close_deployment"],
        mentions: ["CARD"],
        neverMentions: ["shell"]
      },
      {
        toolCalls: [
          { name: "get_deployment", arguments: { dseq: "1" } },
          { name: "propose_update_deployment", arguments: { dseq: "1", services: { web: { image: "nginx:1.27.0" } } } }
        ],
        answer: "I prepared a card to update the image."
      }
    );

    expect(result).toEqual({ id: "update-image", passed: true, failures: [] });
  });

  it("passes an empty expectation", () => {
    expect(scoreAssistantEval("anything", {}, { toolCalls: [{ name: "search_docs", arguments: {} }], answer: "" })).toEqual({
      id: "anything",
      passed: true,
      failures: []
    });
  });

  it("reports each tool it should have called and each it should not have", () => {
    const result = scoreAssistantEval(
      "calls",
      { calls: ["get_bids", "search_docs"], neverCalls: ["get_deployment", "list_templates"] },
      {
        toolCalls: [
          { name: "search_docs", arguments: {} },
          { name: "get_deployment", arguments: {} }
        ],
        answer: ""
      }
    );

    expect(result).toEqual({ id: "calls", passed: false, failures: ["did not call get_bids", "called get_deployment"] });
  });

  it("reports a missing proposal", () => {
    const result = scoreAssistantEval(
      "proposal",
      { proposes: "buy_credits", proposalMentions: ["50"] },
      { toolCalls: [{ name: "propose_configure_auto_recharge", arguments: { amountUsd: 50 } }], answer: "" }
    );

    expect(result.failures).toEqual(["did not propose buy_credits"]);
  });

  it("reports a proposal that lacks the expected arguments", () => {
    const result = scoreAssistantEval(
      "proposal",
      { proposes: "buy_credits", proposalMentions: ["50", "20"] },
      { toolCalls: [{ name: "propose_buy_credits", arguments: { amountUsd: 20 } }], answer: "" }
    );

    expect(result.failures).toEqual(['buy_credits proposal lacks "50"']);
  });

  it("matches the expected arguments across every proposal of the type", () => {
    const result = scoreAssistantEval(
      "proposal",
      { proposes: "buy_credits", proposalMentions: ["50", "20"] },
      {
        toolCalls: [
          { name: "propose_buy_credits", arguments: { amountUsd: 20 } },
          { name: "propose_buy_credits", arguments: { amountUsd: 50 } }
        ],
        answer: ""
      }
    );

    expect(result.passed).toBe(true);
  });

  it("reports any proposal when none was expected, ignoring tools that are not proposals", () => {
    const result = scoreAssistantEval(
      "refuse",
      { neverProposes: true },
      {
        toolCalls: [
          { name: "search_docs", arguments: {} },
          { name: "propose_unknown", arguments: {} },
          { name: "propose_close_deployment", arguments: {} },
          { name: "propose_buy_credits", arguments: {} }
        ],
        answer: ""
      }
    );

    expect(result.failures).toEqual(["proposed close_deployment, buy_credits"]);
  });

  it("reports each forbidden proposal type it made", () => {
    const result = scoreAssistantEval(
      "forbidden",
      { neverProposesTypes: ["close_deployment", "create_deployment"] },
      { toolCalls: [{ name: "propose_close_deployment", arguments: {} }], answer: "" }
    );

    expect(result.failures).toEqual(["proposed close_deployment"]);
  });

  it("reports what the answer lacks and what it must not say, ignoring case", () => {
    const result = scoreAssistantEval(
      "answer",
      { mentions: ["Discord", "escrow"], neverMentions: ["Raise Your Price", "denom"] },
      { toolCalls: [], answer: "Ask on discord, or raise your price." }
    );

    expect(result.failures).toEqual(['answer lacks "escrow"', 'answer says "Raise Your Price"']);
  });

  it("names only tools the assistant offers in every case", () => {
    const toolNames = new Set(assistantChatTools().map(tool => tool.function.name));
    const named = ASSISTANT_EVAL_CASES.flatMap(evalCase => [
      ...(evalCase.expect.calls ?? []),
      ...(evalCase.expect.neverCalls ?? []),
      ...Object.keys(evalCase.toolResults ?? {})
    ]);

    expect(named.filter(name => !toolNames.has(name))).toEqual([]);
    expect(new Set(ASSISTANT_EVAL_CASES.map(({ id }) => id)).size).toBe(ASSISTANT_EVAL_CASES.length);
  });

  describe(formatAssistantEvalTable.name, () => {
    it("prints one row per case with its failures and the pass count", () => {
      const table = formatAssistantEvalTable([
        { id: "short", passed: true, failures: [] },
        { id: "a-longer-case", passed: false, failures: ["did not call get_bids", "called get_deployment"] }
      ]);

      expect(table).toBe(
        ["case           result", "short          PASS", "a-longer-case  FAIL  did not call get_bids; called get_deployment", "", "1/2 passed"].join("\n")
      );
    });

    it("keeps the header column wide enough for short ids", () => {
      expect(formatAssistantEvalTable([{ id: "a", passed: true, failures: [] }])).toBe(["case  result", "a     PASS", "", "1/1 passed"].join("\n"));
    });
  });
});
