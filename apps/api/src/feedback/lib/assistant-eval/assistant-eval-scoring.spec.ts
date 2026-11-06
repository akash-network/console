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

  it("reports repeated calls when they are not allowed", () => {
    const toolCalls = [
      { name: "get_bids", arguments: { dseq: "1" } },
      { name: "get_bids", arguments: { dseq: "1" }, repeated: true }
    ];

    expect(scoreAssistantEval("repeats", { neverRepeatsCalls: true }, { toolCalls, answer: "No bids." }).failures).toEqual(["repeated get_bids"]);
    expect(scoreAssistantEval("repeats", {}, { toolCalls, answer: "No bids." }).failures).toEqual([]);
  });

  it("reports each sentence that advises raising the price or switching the denom", () => {
    const answer = [
      "It closed with no bids.",
      "Increase the maximum price you're willing to pay!",
      "Try a higher bid?",
      "Or pay more",
      "Switch the denom to uakt."
    ].join("\n");

    expect(scoreAssistantEval("reprice", { neverAdvisesRepricing: true }, { toolCalls: [], answer }).failures).toEqual([
      `answer advises repricing: "Increase the maximum price you're willing to pay!"`,
      'answer advises repricing: "Try a higher bid?"',
      'answer advises repricing: "Or pay more"',
      'answer advises repricing: "Switch the denom to uakt."'
    ]);
    expect(scoreAssistantEval("reprice", {}, { toolCalls: [], answer }).failures).toEqual([]);
  });

  it.each([
    "Raising your bid will get you a lease.",
    "Bump the pricing.",
    "Boost the price.",
    "You are willing to pay enough.",
    "Changing the SDL denom helps.",
    "Try raising your prices to attract bids.",
    "Consider higher prices.",
    "Offer higher bids."
  ])("reports repricing advice in %j", answer => {
    expect(scoreAssistantEval("reprice", { neverAdvisesRepricing: true }, { toolCalls: [], answer }).failures).toEqual([
      `answer advises repricing: "${answer}"`
    ]);
  });

  it.each([
    "Don't raise the price.",
    "Do not raise the price.",
    "Never raise the price.",
    "There is no need to raise the price.",
    "Drop the region attribute instead of raising the price.",
    "Change resources rather than raising the price.",
    "Redeploy without raising the price.",
    "Increase the GPU count so more providers send bids.",
    "Increase memory. The price stays the same.",
    "Praise the price.",
    "The bid price is higher than usual.",
    "Your deployment shows a higher pricetag",
    "Change the region attribute in your SDL and keep everything else, denom included.",
    "Interchange nothing; the denom stays."
  ])("accepts %j", answer => {
    expect(scoreAssistantEval("reprice", { neverAdvisesRepricing: true }, { toolCalls: [], answer }).failures).toEqual([]);
  });

  it("passes an answer that names a deployment only through its link", () => {
    const answer = "[my-web](/deployments/42) costs $1.28 per month.";

    expect(scoreAssistantEval("spend", { linksDeployments: ["42"] }, { toolCalls: [], answer })).toEqual({ id: "spend", passed: true, failures: [] });
  });

  it("reports a deployment it does not link and one whose dseq it also writes bare", () => {
    const answer = "Deployment 42 costs $1.28 per month, and [deployment 4...](/deployments/43) on 43 costs $2.";

    expect(scoreAssistantEval("spend", { linksDeployments: ["42", "43"] }, { toolCalls: [], answer }).failures).toEqual([
      "answer does not link deployment 42",
      "answer writes a bare dseq 43"
    ]);
  });

  it("fails an answer the model left to the fallback", () => {
    expect(scoreAssistantEval("silent", {}, { toolCalls: [], answer: "I read your deployments.", fellBack: true }).failures).toEqual([
      "answered only with the fallback"
    ]);
  });

  it("fails an answer that writes an akash1 address, whatever the case expects", () => {
    expect(scoreAssistantEval("address", {}, { toolCalls: [], answer: "It runs on AKASH1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh." }).failures).toEqual([
      "answer writes an akash1 address"
    ]);
    expect(scoreAssistantEval("address", {}, { toolCalls: [], answer: "It runs on provider.europlots.com." }).failures).toEqual([]);
  });

  it("reports each text a tool's arguments lack, across every call of that tool", () => {
    const result = scoreAssistantEval(
      "call-arguments",
      { callMentions: { read_console_api: ["/V1/PROJECTS", "limit"], get_bids: ["42"] } },
      {
        toolCalls: [
          { name: "read_console_api", arguments: { path: "/v1/organizations" } },
          { name: "read_console_api", arguments: { path: "/v1/projects" } },
          { name: "get_deployment", arguments: { dseq: "42" } }
        ],
        answer: ""
      }
    );

    expect(result.failures).toEqual(['read_console_api call lacks "limit"', 'get_bids call lacks "42"']);
  });

  it("passes when the answer says any one of the alternatives, ignoring case", () => {
    const result = scoreAssistantEval("alternatives", { mentionsAnyOf: ["redeploy", "Deadline"] }, { toolCalls: [], answer: "Move it before the DEADLINE." });

    expect(result).toEqual({ id: "alternatives", passed: true, failures: [] });
  });

  it("reports an answer that says none of the alternatives", () => {
    const result = scoreAssistantEval("alternatives", { mentionsAnyOf: ["redeploy", "deadline"] }, { toolCalls: [], answer: "Nothing to do." });

    expect(result.failures).toEqual(['answer lacks any of "redeploy", "deadline"']);
  });

  it("names only tools the assistant offers in every case", () => {
    const toolNames = new Set(assistantChatTools().map(tool => tool.function.name));
    const named = ASSISTANT_EVAL_CASES.flatMap(evalCase => [
      ...(evalCase.expect.calls ?? []),
      ...(evalCase.expect.neverCalls ?? []),
      ...Object.keys(evalCase.expect.callMentions ?? {}),
      ...Object.keys(evalCase.toolResults ?? {}),
      ...Object.keys(evalCase.toolErrors ?? {})
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
