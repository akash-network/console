import { describe, expect, it } from "vitest";

import { assistantChatTools } from "@src/feedback/lib/assistant-tools/assistant-tools";
import { ASSISTANT_EVAL_CASES } from "./assistant-eval-cases";
import { formatAssistantEvalTable, scoreAssistantEval, sdlValidationErrorsOf } from "./assistant-eval-scoring";

const PERSISTENT_POSTGRES_SDL = `
version: "2.0"
services:
  postgres:
    image: postgres:16
    expose:
      - port: 5432
        to:
          - global: true
    params:
      storage:
        data:
          mount: /var/lib/postgresql/data
profiles:
  compute:
    postgres:
      resources:
        cpu:
          units: 1
        memory:
          size: 1Gi
        storage:
          - size: 1Gi
          - name: data
            size: 10Gi
            attributes:
              persistent: true
              class: beta3
  placement:
    dcloud:
      pricing:
        postgres:
          denom: uact
          amount: 10000
deployment:
  postgres:
    dcloud:
      profile: postgres
      count: 1
`;

const STORAGE_AS_MAP_SDL = PERSISTENT_POSTGRES_SDL.replace(
  "          - size: 1Gi\n          - name: data\n            size: 10Gi",
  "          data:\n            size: 10Gi"
);

const PRICELESS_POSTGRES_SDL = PERSISTENT_POSTGRES_SDL.replace("    dcloud:\n      pricing:\n        postgres:\n          denom: uact\n          amount: 10000\n", "    dcloud: {}\n");

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

  it("reports a first round that does not call only the expected tool", () => {
    const expectation = { callsFirst: "read_configure_form" };
    const readForm = { name: "read_configure_form", arguments: {} };
    const searchDocs = { name: "search_docs", arguments: {} };

    expect(
      scoreAssistantEval("first", expectation, {
        toolCalls: [
          { ...readForm, round: 0 },
          { ...searchDocs, round: 1 }
        ],
        answer: ""
      }).failures
    ).toEqual([]);
    expect(
      scoreAssistantEval("first", expectation, {
        toolCalls: [
          { ...searchDocs, round: 0 },
          { ...readForm, round: 1 }
        ],
        answer: ""
      }).failures
    ).toEqual(["called search_docs before read_configure_form"]);
    expect(
      scoreAssistantEval("first", expectation, {
        toolCalls: [
          { ...readForm, round: 0 },
          { ...searchDocs, round: 0 },
          { ...searchDocs, round: 0 }
        ],
        answer: ""
      }).failures
    ).toEqual(["called search_docs alongside read_configure_form"]);
    expect(scoreAssistantEval("first", expectation, { toolCalls: [], answer: "" }).failures).toEqual(["called nothing before read_configure_form"]);
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
      ...(evalCase.expect.callsFirst ? [evalCase.expect.callsFirst] : []),
      ...Object.keys(evalCase.toolResults ?? {})
    ]);

    expect(named.filter(name => !toolNames.has(name))).toEqual([]);
    expect(new Set(ASSISTANT_EVAL_CASES.map(({ id }) => id)).size).toBe(ASSISTANT_EVAL_CASES.length);
  });

  it("reports a proposed SDL that is not valid when the case expects a valid one", () => {
    const proposeSdl = (sdl: string) => ({ toolCalls: [{ name: "propose_create_deployment", arguments: { sdl } }], answer: "" });

    expect(scoreAssistantEval("sdl", { proposes: "create_deployment", proposesValidSdl: true }, proposeSdl(PERSISTENT_POSTGRES_SDL)).failures).toEqual([]);
    expect(scoreAssistantEval("sdl", { proposes: "create_deployment", proposesValidSdl: true }, proposeSdl(PRICELESS_POSTGRES_SDL)).failures).toEqual([]);
    expect(scoreAssistantEval("sdl", { proposes: "create_deployment", proposesValidSdl: true }, proposeSdl(STORAGE_AS_MAP_SDL)).failures).toEqual([
      expect.stringMatching(/^create_deployment proposal has an SDL that is not valid: \/profiles\/compute\/postgres\/resources\/storage /)
    ]);
    expect(scoreAssistantEval("sdl", { proposes: "create_deployment" }, proposeSdl(STORAGE_AS_MAP_SDL)).failures).toEqual([]);
  });

  describe(sdlValidationErrorsOf.name, () => {
    it("finds nothing wrong with a valid SDL", () => {
      expect(sdlValidationErrorsOf(PERSISTENT_POSTGRES_SDL)).toEqual([]);
    });

    it("accepts an SDL without pricing, since a create prices it at the default ceiling", () => {
      expect(sdlValidationErrorsOf(PRICELESS_POSTGRES_SDL)).toEqual([]);
    });

    it("names where a storage map should have been a list", () => {
      expect(sdlValidationErrorsOf(STORAGE_AS_MAP_SDL)).toContain(
        '/profiles/compute/postgres/resources/storage "storage" at "/profiles/compute/postgres/resources" should be array.'
      );
    });

    it("reports YAML that does not parse and a missing SDL", () => {
      expect(sdlValidationErrorsOf("services: [")).toEqual([expect.stringMatching(/^the YAML does not parse: \S/)]);
      expect(sdlValidationErrorsOf(undefined)).toEqual(["there is no SDL"]);
    });
  });

  it("answers the persistent postgres case's availability checks by whether the screened SDL is valid", () => {
    const writePostgres = ASSISTANT_EVAL_CASES.find(({ id }) => id === "write-persistent-postgres");
    const checkAvailability = writePostgres?.toolResults?.check_availability as (args: Record<string, unknown>) => unknown;

    expect(checkAvailability({ sdl: PERSISTENT_POSTGRES_SDL })).toMatchObject({ providersAbleToBid: 14 });
    expect(checkAvailability({ sdl: PRICELESS_POSTGRES_SDL })).toMatchObject({ providersAbleToBid: 14 });
    expect(checkAvailability({ sdl: STORAGE_AS_MAP_SDL })).toEqual({ error: expect.stringMatching(/^The SDL is not valid: \/profiles\/compute\/postgres/) });
    expect(checkAvailability({ templateId: "postgres" })).toEqual({ error: expect.stringMatching(/^The SDL is not valid: \S/) });
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
