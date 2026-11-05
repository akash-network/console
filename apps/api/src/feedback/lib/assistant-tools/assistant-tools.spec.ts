import { describe, expect, it } from "vitest";
import { z } from "zod";

import { CLIENT_TOOL_ARGUMENTS, PROPOSAL_TOOL_ARGUMENTS, READ_TOOL_ARGUMENTS } from "./assistant-tool-arguments";
import { assistantChatTools, isClientToolName, isReadToolName, jsonSchemaOf, proposalActionTypeOf, proposalToolNameOf } from "./assistant-tools";

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

  it("offers every read, client and proposal tool once, with a description and no references", () => {
    const tools = assistantChatTools();
    const names = tools.map(({ function: { name } }) => name);

    expect(names).toEqual([
      ...Object.keys(READ_TOOL_ARGUMENTS),
      ...Object.keys(CLIENT_TOOL_ARGUMENTS),
      ...Object.keys(PROPOSAL_TOOL_ARGUMENTS).map(type => `propose_${type}`)
    ]);
    expect(tools.every(({ type, function: { description, parameters } }) => type === "function" && !!description && parameters.type === "object")).toBe(true);
    expect(JSON.stringify(tools)).not.toContain("$ref");
    expect(assistantChatTools()).toBe(tools);
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
