import { describe, expect, it } from "vitest";
import { z } from "zod";

import { CLIENT_TOOL_ARGUMENTS, PROPOSAL_TOOL_ARGUMENTS, READ_TOOL_ARGUMENTS } from "./assistant-tool-arguments";
import {
  assistantChatTools,
  isClientToolName,
  isLiveHelpToolName,
  isReadToolName,
  jsonSchemaOf,
  proposalActionTypeOf,
  proposalToolNameOf,
  splitProposalArguments
} from "./assistant-tools";

describe("assistant tools", () => {
  it("names proposal tools after their action and reads them back", () => {
    expect(proposalToolNameOf("close_deployment")).toBe("propose_close_deployment");
    expect(proposalActionTypeOf("propose_close_deployment")).toBe("close_deployment");
    expect(proposalActionTypeOf("propose_shell")).toBeNull();
    expect(proposalActionTypeOf("close_deployment")).toBeNull();
  });

  it("tells read and client tools apart without matching inherited names", () => {
    expect(isReadToolName("get_bids")).toBe(true);
    expect(isReadToolName("read_logs")).toBe(false);
    expect(isReadToolName("toString")).toBe(false);
    expect(isClientToolName("read_logs")).toBe(true);
    expect(isClientToolName("get_bids")).toBe(false);
    expect(isClientToolName("constructor")).toBe(false);
  });

  it("converts a schema to plain JSON schema", () => {
    expect(jsonSchemaOf(z.object({ dseq: z.string(), count: z.number().int().optional() }))).toEqual({
      type: "object",
      properties: { dseq: { type: "string" }, count: { type: "integer" } },
      required: ["dseq"]
    });
  });

  it("recognizes only the live help tool as live help", () => {
    expect(isLiveHelpToolName("suggest_live_help")).toBe(true);
    expect(isLiveHelpToolName("propose_suggest_live_help")).toBe(false);
  });

  it("splits a fix's diagnosis from the action's arguments", () => {
    const diagnosis = { summary: "Out of memory", evidence: ["OOMKilled"] };

    expect(splitProposalArguments("redeploy_with_resources", { dseq: "42", diagnosis })).toEqual({ actionArguments: { dseq: "42" }, diagnosis });
    expect(splitProposalArguments("redeploy_with_resources", { dseq: "42" })).toEqual({ actionArguments: { dseq: "42" }, diagnosis: undefined });
    expect(splitProposalArguments("redeploy_with_resources", ["42"])).toEqual({ actionArguments: ["42"], diagnosis: undefined });
    expect(splitProposalArguments("redeploy_with_resources", null)).toEqual({ actionArguments: null, diagnosis: undefined });
  });

  it("drops the diagnosis of a proposal that fixes nothing", () => {
    const diagnosis = { summary: "User wants a Hello World app deployed.", evidence: [] };

    expect(splitProposalArguments("create_deployment", { templateId: "hello", diagnosis })).toEqual({
      actionArguments: { templateId: "hello" },
      diagnosis: undefined
    });
  });

  it("keeps an editor diagnosis only when the editor opens an existing deployment", () => {
    const diagnosis = { summary: "The provider closed the lease.", evidence: ["lease closed: insufficient funds"] };

    expect(splitProposalArguments("open_in_editor", { dseq: "42", diagnosis })).toEqual({ actionArguments: { dseq: "42" }, diagnosis });
    expect(splitProposalArguments("open_in_editor", { templateId: "hello", diagnosis })).toEqual({
      actionArguments: { templateId: "hello" },
      diagnosis: undefined
    });
    expect(splitProposalArguments("open_in_editor", { sdl: "version: '2.0'", diagnosis })).toEqual({
      actionArguments: { sdl: "version: '2.0'" },
      diagnosis: undefined
    });
  });

  it("offers every read, client and proposal tool once, with a description and no references", () => {
    const tools = assistantChatTools();
    const names = tools.map(({ function: { name } }) => name);

    expect(names).toEqual([
      ...Object.keys(READ_TOOL_ARGUMENTS),
      ...Object.keys(CLIENT_TOOL_ARGUMENTS),
      ...Object.keys(PROPOSAL_TOOL_ARGUMENTS).map(type => `propose_${type}`),
      "suggest_live_help"
    ]);
    expect(tools.every(({ type, function: { description, parameters } }) => type === "function" && !!description && parameters.type === "object")).toBe(true);
    expect(JSON.stringify(tools)).not.toContain("$ref");
    expect(assistantChatTools()).toBe(tools);
  });

  it("lets a fix carry an optional diagnosis next to its own arguments", () => {
    const parameters = assistantChatTools().find(tool => tool.function.name === "propose_close_deployment")!.function.parameters;

    expect(parameters.required).toEqual(["dseq", "reason"]);
    expect(parameters.properties).toMatchObject({
      dseq: expect.objectContaining({ type: "string" }),
      diagnosis: {
        type: "object",
        description: expect.stringContaining("diagnosed"),
        properties: { summary: expect.objectContaining({ maxLength: 300 }), evidence: expect.objectContaining({ type: "array", maxItems: 6 }) },
        required: ["summary", "evidence"]
      }
    });
  });

  it("offers a diagnosis only on proposals that fix a problem", () => {
    const proposalsWithDiagnosis = assistantChatTools()
      .filter(({ function: { name, parameters } }) => name.startsWith("propose_") && Object.hasOwn(parameters.properties as object, "diagnosis"))
      .map(({ function: { name } }) => name);

    expect(proposalsWithDiagnosis).toEqual([
      "propose_update_deployment",
      "propose_set_secret",
      "propose_set_registry_credentials",
      "propose_redeploy_with_resources",
      "propose_send_manifest_again",
      "propose_close_deployment",
      "propose_open_in_editor"
    ]);
  });

  it("asks for a typed reason when offering live help", () => {
    const parameters = assistantChatTools().find(tool => tool.function.name === "suggest_live_help")!.function.parameters;

    expect(parameters).toMatchObject({
      required: ["reason"],
      properties: { reason: { type: "string", enum: ["provider_side_issue", "not_supported_here", "no_confident_answer", "user_asked_for_a_person"] } }
    });
  });

  it("offers no shell, deletion, role or key tools", () => {
    const names = assistantChatTools().map(({ function: { name } }) => name);

    expect(names.filter(name => /shell|exec|delete|role|owner|api_key|payment_method/.test(name))).toEqual([]);
  });

  it("describes what each read tool returns", () => {
    const describe = (name: string) => assistantChatTools().find(tool => tool.function.name === name)?.function.description;

    expect(describe("get_bids")).toMatch(/how many providers could bid/);
    expect(describe("read_logs")).toMatch(/untrusted/);
    expect(describe("propose_set_secret")).toMatch(/Only the name/);
  });
});
