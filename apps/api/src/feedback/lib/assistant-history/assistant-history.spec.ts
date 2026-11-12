import { describe, expect, it } from "vitest";

import { MAX_ASSISTANT_HISTORY_MESSAGES } from "@src/feedback/http-schemas/assistant-conversation.schema";
import { REDACTED } from "@src/feedback/lib/redact-secrets/redact-secrets";
import {
  ACTION_RESULT_TOOL_NAME,
  historyFromClient,
  historyFromStored,
  MAX_HISTORY_LENGTH,
  MAX_RECENT_ACTION_NAME_LENGTH,
  MAX_RECENT_ACTIONS,
  recentActionsOf
} from "./assistant-history";

describe("assistant history", () => {
  describe(historyFromStored.name, () => {
    it("replays user and assistant messages, cards and action outcomes, and drops tool reads", () => {
      expect(
        historyFromStored([
          { role: "user", content: "why no bids?", toolName: null },
          { role: "tool", content: "Read the bids on deployment 1", toolName: "get_bids" },
          { role: "tool", content: "Proposed redeploy with resources", toolName: "propose_redeploy_with_resources" },
          { role: "assistant", content: "Try one GPU.", toolName: null },
          { role: "tool", content: "redeploy with resources, confirmed", toolName: ACTION_RESULT_TOOL_NAME },
          { role: "tool", content: "Read logs in the browser", toolName: null }
        ])
      ).toEqual([
        { role: "user", content: "why no bids?" },
        { role: "assistant", content: "[Card shown to the user] Proposed redeploy with resources" },
        { role: "assistant", content: "Try one GPU." },
        { role: "user", content: "[Action card outcome reported by Console] redeploy with resources, confirmed" }
      ]);
    });
  });

  describe(recentActionsOf.name, () => {
    const at = new Date("2026-11-06T05:38:41.000Z");

    it("describes each card outcome with its deployment, status and minute", () => {
      expect(
        recentActionsOf([
          { toolName: "get_bids", toolPayload: { toolCallId: "c1", ok: true }, createdAt: at },
          { toolName: "propose_create_deployment", toolPayload: { proposalId: "p1", action: { type: "create_deployment", name: "dart" } }, createdAt: at },
          {
            toolName: "propose_close_deployment",
            toolPayload: { proposalId: "p2", action: { type: "close_deployment", dseq: "7", name: "web" } },
            createdAt: at
          },
          { toolName: "propose_buy_credits", toolPayload: { proposalId: "p3", action: { type: "buy_credits" } }, createdAt: at },
          {
            toolName: ACTION_RESULT_TOOL_NAME,
            toolPayload: { proposalId: "p1", actionType: "create_deployment", decision: "confirmed", outcome: "succeeded", error: null },
            createdAt: at
          },
          {
            toolName: ACTION_RESULT_TOOL_NAME,
            toolPayload: { proposalId: "p2", actionType: "close_deployment", decision: "confirmed", outcome: "failed", error: `boom ${"x".repeat(200)}` },
            createdAt: at
          },
          { toolName: ACTION_RESULT_TOOL_NAME, toolPayload: { proposalId: "p3", actionType: "buy_credits", decision: "cancelled" }, createdAt: at }
        ])
      ).toEqual([
        'create deployment named "dart": confirmed, succeeded at 2026-11-06 05:38 UTC',
        "close deployment on deployment 7: confirmed, failed at 2026-11-06 05:38 UTC",
        "buy credits: cancelled at 2026-11-06 05:38 UTC"
      ]);
    });

    it("leaves out the reported error text and cuts long card names", () => {
      const longName = `${"n".repeat(MAX_RECENT_ACTION_NAME_LENGTH)}tail`;

      const actions = recentActionsOf([
        { toolName: "propose_create_deployment", toolPayload: { proposalId: "p1", action: { type: "create_deployment", name: longName } }, createdAt: at },
        {
          toolName: ACTION_RESULT_TOOL_NAME,
          toolPayload: { proposalId: "p1", actionType: "create_deployment", decision: "confirmed", outcome: "failed", error: "insufficient funds" },
          createdAt: at
        }
      ]);

      expect(actions).toEqual([`create deployment named "${"n".repeat(MAX_RECENT_ACTION_NAME_LENGTH)}": confirmed, failed at 2026-11-06 05:38 UTC`]);
      expect(actions.join("\n")).not.toContain("insufficient funds");
    });

    it("keeps only the latest outcomes", () => {
      const outcomes = Array.from({ length: MAX_RECENT_ACTIONS + 1 }, (_, index) => ({
        toolName: ACTION_RESULT_TOOL_NAME,
        toolPayload: { proposalId: `p${index}`, actionType: `action_${index}`, decision: "cancelled" },
        createdAt: at
      }));

      const actions = recentActionsOf(outcomes);

      expect(actions).toHaveLength(MAX_RECENT_ACTIONS);
      expect(actions[0]).toBe("action 1: cancelled at 2026-11-06 05:38 UTC");
    });

    it("skips payloads it cannot read and redacts what it shows", () => {
      expect(
        recentActionsOf([
          { toolName: "propose_rename_deployment", toolPayload: null, createdAt: at },
          { toolName: "propose_rename_deployment", toolPayload: { proposalId: "p1", action: { name: "token=abcdef123456" } }, createdAt: at },
          { toolName: ACTION_RESULT_TOOL_NAME, toolPayload: { proposalId: "p2" }, createdAt: at },
          { toolName: null, toolPayload: { proposalId: "p3", actionType: "x", decision: "cancelled" }, createdAt: at },
          { toolName: ACTION_RESULT_TOOL_NAME, toolPayload: { proposalId: "p1", actionType: "rename_deployment", decision: "cancelled" }, createdAt: at }
        ])
      ).toEqual([`rename deployment named "token=${REDACTED}": cancelled at 2026-11-06 05:38 UTC`]);
    });
  });

  describe(historyFromClient.name, () => {
    it("redacts secrets the client sends back", () => {
      expect(historyFromClient([{ role: "user", content: "my token=abcdef123456" }])).toEqual([{ role: "user", content: `my token=${REDACTED}` }]);
    });

    it("returns nothing without history", () => {
      expect(historyFromClient(undefined)).toEqual([]);
    });

    it("keeps only the latest messages up to the message cap", () => {
      const history = Array.from({ length: MAX_ASSISTANT_HISTORY_MESSAGES + 2 }, (_, index) => ({ role: "user" as const, content: `m${index}` }));

      const kept = historyFromClient(history);

      expect(kept).toHaveLength(MAX_ASSISTANT_HISTORY_MESSAGES);
      expect(kept[0]).toEqual({ role: "user", content: "m2" });
      expect(kept.at(-1)).toEqual({ role: "user", content: `m${MAX_ASSISTANT_HISTORY_MESSAGES + 1}` });
    });

    it("keeps the latest messages that fit in the length cap", () => {
      const half = "x".repeat(MAX_HISTORY_LENGTH / 2);

      expect(
        historyFromClient([
          { role: "user", content: "oldest" },
          { role: "assistant", content: half },
          { role: "user", content: half }
        ])
      ).toEqual([
        { role: "assistant", content: half },
        { role: "user", content: half }
      ]);
    });
  });
});
