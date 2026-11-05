import createError from "http-errors";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { AssistantAction } from "@src/feedback/http-schemas/assistant-action.schema";
import { AssistantToolError } from "@src/feedback/lib/assistant-tool-error/assistant-tool-error";
import { REDACTED } from "@src/feedback/lib/redact-secrets/redact-secrets";
import type { ChatToolCall } from "@src/feedback/services/akashml-client/akashml.client";
import type { AssistantAccountToolsService } from "@src/feedback/services/assistant-account-tools/assistant-account-tools.service";
import type { AssistantBidToolsService } from "@src/feedback/services/assistant-bid-tools/assistant-bid-tools.service";
import type { AssistantDeploymentToolsService } from "@src/feedback/services/assistant-deployment-tools/assistant-deployment-tools.service";
import type { AssistantProposalService } from "@src/feedback/services/assistant-proposal/assistant-proposal.service";
import { AssistantToolRunnerService, MAX_TOOL_RESULT_LENGTH, toolContentOf, truncated } from "./assistant-tool-runner.service";

const UUID = /^[0-9a-f-]{36}$/;

function call(name: string, args: unknown): ChatToolCall {
  return { id: "call-1", type: "function", function: { name, arguments: typeof args === "string" ? args : JSON.stringify(args) } };
}

describe(AssistantToolRunnerService.name, () => {
  describe(truncated.name, () => {
    it("keeps short text and marks cut text at the limit", () => {
      expect(truncated("short", 10)).toBe("short");
      expect(truncated("x".repeat(30), 20)).toBe(`${"x".repeat(6)}...[truncated]`);
      expect(truncated("x".repeat(30), 20)).toHaveLength(20);
    });
  });

  describe(toolContentOf.name, () => {
    it("wraps data as redacted JSON bounded to the result limit", () => {
      expect(toolContentOf("get_deployment", { data: { env: "password=hunter2" } })).toBe(`{"tool":"get_deployment","data":{"env":"password=${REDACTED}"}}`);
      expect(toolContentOf("get_deployment", { data: "x".repeat(MAX_TOOL_RESULT_LENGTH) })).toHaveLength(MAX_TOOL_RESULT_LENGTH);
      expect(toolContentOf("get_bids", { error: "nope" })).toBe('{"tool":"get_bids","error":"nope"}');
    });
  });

  describe("read tools", () => {
    it.each([
      ["list_deployments", { state: "closed" }, "Read your deployments", "deploymentTools", "listDeployments"],
      ["get_deployment", { dseq: "42" }, "Read deployment 42", "deploymentTools", "getDeployment"],
      ["get_lease_close_reason", { dseq: "42" }, "Read why deployment 42 closed", "deploymentTools", "getLeaseCloseReason"],
      ["get_bids", { dseq: "42" }, "Read the bids on deployment 42", "bidTools", "getBids"],
      ["get_balance_and_spend", {}, "Read your balance and spend", "accountTools", "getBalanceAndSpend"],
      ["list_templates", { query: "llama" }, "Searched the template gallery", "accountTools", "listTemplates"]
    ] as const)("runs %s with validated arguments and summarizes what it read", async (name, args, summary, tools, method) => {
      const mocks = setup();
      const read = vi.mocked((mocks[tools] as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>)[method]);
      read.mockResolvedValue({ read: name });

      const outcome = await mocks.runner.run(call(name, args), { isTrialing: false });

      expect(read).toHaveBeenCalledWith(args);
      expect(outcome).toEqual({ kind: "result", content: toolContentOf(name, { data: { read: name } }), summary, ok: true });
    });

    it("passes the parsed arguments to the read", async () => {
      const { runner, deploymentTools } = setup();
      deploymentTools.listDeployments.mockResolvedValue({ total: 0, hasMore: false, deployments: [] });

      await runner.run(call("list_deployments", { search: "web" }), { isTrialing: false });

      expect(deploymentTools.listDeployments).toHaveBeenCalledWith({ search: "web" });
    });

    it("searches the knowledge pack", async () => {
      const { runner } = setup();

      const outcome = await runner.run(call("search_docs", { query: "OOMKilled memory" }), { isTrialing: false });

      expect(outcome).toMatchObject({ kind: "result", ok: true, summary: "Searched the Console docs" });
      expect((outcome as Extract<typeof outcome, { kind: "result" }>).content).toContain("troubleshooting-runtime#out-memory");
    });

    it("treats empty arguments as an empty object", async () => {
      const { runner } = setup();

      expect(await runner.run(call("get_balance_and_spend", ""), { isTrialing: false })).toMatchObject({ ok: true });
    });
  });

  describe("client tools", () => {
    it("hands browser tools back with defaults applied", async () => {
      const { runner } = setup();

      expect(await runner.run(call("read_logs", { dseq: "42" }), { isTrialing: false })).toEqual({
        kind: "client",
        call: { id: "call-1", name: "read_logs", arguments: { dseq: "42", tailLines: 100 } }
      });
      expect(await runner.run(call("read_events", { dseq: "42", extra: 1 }), { isTrialing: false })).toEqual({
        kind: "client",
        call: { id: "call-1", name: "read_events", arguments: { dseq: "42" } }
      });
    });
  });

  describe("proposals", () => {
    it("builds the action and tells the model the user decides", async () => {
      const { runner, proposalService } = setup();
      const action: AssistantAction = { type: "buy_credits", tier: "deep_link", amountUsd: 20 };
      proposalService.propose.mockResolvedValue(action);

      const outcome = await runner.run(call("propose_buy_credits", { amountUsd: 20 }), { isTrialing: true });
      const proposal = outcome as Extract<typeof outcome, { kind: "proposal" }>;

      expect(proposalService.propose).toHaveBeenCalledWith("buy_credits", { amountUsd: 20 }, { isTrialing: true });
      expect(proposal).toMatchObject({ kind: "proposal", ok: true, summary: "Proposed buy credits", action, proposalId: expect.stringMatching(UUID) });
      expect(JSON.parse(proposal.content)).toEqual({
        tool: "propose_buy_credits",
        data: { proposalId: proposal.proposalId, shownToUser: true, note: "The user now sees a card and decides. Do not claim it is done." }
      });
    });
  });

  describe("diagnosis", () => {
    it("carries the diagnosis apart from the action's arguments, redacted", async () => {
      const { runner, proposalService } = setup();
      const action: AssistantAction = { type: "send_manifest_again", tier: "confirm", dseq: "42" };
      proposalService.propose.mockResolvedValue(action);
      const diagnosis = { summary: "The model is gated and token=abc123 is wrong.", evidence: ["OSError: gated repo", "HF_TOKEN=hf_abcdefghijklmnopqrstuvwx"] };

      const outcome = await runner.run(call("propose_send_manifest_again", { dseq: "42", diagnosis }), { isTrialing: false });

      expect(proposalService.propose).toHaveBeenCalledWith("send_manifest_again", { dseq: "42" }, { isTrialing: false });
      expect(outcome).toMatchObject({
        kind: "proposal",
        action,
        diagnosis: { summary: `The model is gated and token=${REDACTED} is wrong.`, evidence: ["OSError: gated repo", `HF_TOKEN=${REDACTED}`] }
      });
    });

    it("leaves the diagnosis out when the model gives none", async () => {
      const { runner, proposalService } = setup();
      proposalService.propose.mockResolvedValue({ type: "send_manifest_again", tier: "confirm", dseq: "42" });

      const outcome = await runner.run(call("propose_send_manifest_again", { dseq: "42" }), { isTrialing: false });

      expect(outcome).not.toHaveProperty("diagnosis");
    });

    it("refuses evidence past the size limits before proposing anything", async () => {
      const { runner, proposalService } = setup();
      const diagnosis = { summary: "Crash loop", evidence: Array.from({ length: 7 }, (_, index) => `line ${index}`) };

      const outcome = await runner.run(call("propose_send_manifest_again", { dseq: "42", diagnosis }), { isTrialing: false });

      expect(outcome).toMatchObject({ kind: "result", ok: false });
      expect((outcome as Extract<typeof outcome, { kind: "result" }>).content).toContain("Invalid arguments: diagnosis.evidence");
      expect(proposalService.propose).not.toHaveBeenCalled();
    });
  });

  describe("live help", () => {
    it("signals live help with the reason and asks the model to follow up", async () => {
      const { runner } = setup();

      const outcome = await runner.run(call("suggest_live_help", { reason: "provider_side_issue" }), { isTrialing: false });

      expect(outcome).toEqual({
        kind: "live_help",
        reason: "provider_side_issue",
        content: toolContentOf("suggest_live_help", {
          data: { shownToUser: true, note: "The user now sees a Discord card. Ask one or two short questions about what they were trying to do." }
        })
      });
    });

    it("refuses a reason it does not know", async () => {
      const { runner } = setup();

      expect(await runner.run(call("suggest_live_help", { reason: "bored" }), { isTrialing: false })).toMatchObject({ kind: "result", ok: false });
    });
  });

  describe("refusals", () => {
    it.each([
      [call("open_shell", {}), "There is no tool named open_shell."],
      [call("get_deployment", "{not json"), "The arguments are not valid JSON."],
      [call("propose_send_manifest_again", "[]"), "Invalid arguments: (root) Expected object, received array"],
      [call("get_deployment", { dseq: "abc" }), "Invalid arguments: dseq A dseq is a positive integer"],
      [call("propose_create_deployment", { templateId: "a", sdl: "b" }), "Invalid arguments: (root) Give either a templateId or an sdl, not both"]
    ])("reports %o back to the model", async (toolCall, error) => {
      const { runner } = setup();

      expect(await runner.run(toolCall, { isTrialing: false })).toEqual({
        kind: "result",
        content: toolContentOf(toolCall.function.name, { error }),
        summary: `Could not run ${toolCall.function.name}`,
        ok: false
      });
    });

    it("reports refusals and client errors from the tools as they are", async () => {
      const { runner, deploymentTools, proposalService } = setup();
      proposalService.propose.mockRejectedValue(new AssistantToolError("No such service"));
      deploymentTools.getDeployment.mockRejectedValue(createError(404, "Deployment not found"));

      expect(await runner.run(call("propose_send_manifest_again", { dseq: "1" }), { isTrialing: false })).toMatchObject({
        content: toolContentOf("propose_send_manifest_again", { error: "No such service" })
      });
      expect(await runner.run(call("get_deployment", { dseq: "1" }), { isTrialing: false })).toMatchObject({
        content: toolContentOf("get_deployment", { error: "Deployment not found" })
      });
    });

    it("hides server failures from the model and logs them", async () => {
      const { runner, deploymentTools, logger } = setup();
      const error = createError(500, "connection string leaked");
      deploymentTools.getDeployment.mockRejectedValue(error);

      const outcome = await runner.run(call("get_deployment", { dseq: "1" }), { isTrialing: false });

      expect(outcome).toMatchObject({
        ok: false,
        content: toolContentOf("get_deployment", { error: "The tool failed. Tell the user this data could not be read right now." })
      });
      expect(logger.warn).toHaveBeenCalledWith({ event: "ASSISTANT_TOOL_FAILED", tool: "get_deployment", error });
    });
  });

  function setup() {
    const deploymentTools = mock<AssistantDeploymentToolsService>();
    const bidTools = mock<AssistantBidToolsService>();
    const accountTools = mock<AssistantAccountToolsService>();
    const proposalService = mock<AssistantProposalService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const runner = new AssistantToolRunnerService(
      deploymentTools,
      bidTools,
      accountTools,
      proposalService,
      vi.fn<CreateLogger>(() => logger)
    );

    return { runner, deploymentTools, bidTools, accountTools, proposalService, logger };
  }
});
