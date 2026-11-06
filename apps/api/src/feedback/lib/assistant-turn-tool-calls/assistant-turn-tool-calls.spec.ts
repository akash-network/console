import { describe, expect, it } from "vitest";

import type { ChatMessage, ChatToolCall } from "@src/feedback/services/akashml-client/akashml.client";
import { earlierResultOf, toolCallKeyOf, toolCallsOfCurrentTurn } from "./assistant-turn-tool-calls";

function toolCall(id: string, name: string, args: Record<string, unknown> | string = {}): ChatToolCall {
  return { id, type: "function", function: { name, arguments: typeof args === "string" ? args : JSON.stringify(args) } };
}

describe("assistant turn tool calls", () => {
  describe(toolCallKeyOf.name, () => {
    it("matches the same arguments in any key order, nested too", () => {
      expect(toolCallKeyOf(toolCall("a", "list_deployments", { state: "closed", search: { name: "x", dseq: "1" } }))).toBe(
        toolCallKeyOf(toolCall("b", "list_deployments", { search: { dseq: "1", name: "x" }, state: "closed" }))
      );
    });

    it("treats missing arguments as an empty object", () => {
      expect(toolCallKeyOf(toolCall("a", "get_balance_and_spend", ""))).toBe(toolCallKeyOf(toolCall("b", "get_balance_and_spend", {})));
    });

    it("tells apart other tools, values and arrays", () => {
      const key = toolCallKeyOf(toolCall("a", "get_bids", { dseq: "1", tags: ["a", "b"] }));

      expect(toolCallKeyOf(toolCall("b", "get_deployment", { dseq: "1", tags: ["a", "b"] }))).not.toBe(key);
      expect(toolCallKeyOf(toolCall("c", "get_bids", { dseq: "2", tags: ["a", "b"] }))).not.toBe(key);
      expect(toolCallKeyOf(toolCall("d", "get_bids", { dseq: "1", tags: ["b", "a"] }))).not.toBe(key);
    });

    it("keys arguments that are not JSON by their text", () => {
      expect(toolCallKeyOf(toolCall("a", "get_bids", "{oops"))).toBe(toolCallKeyOf(toolCall("b", "get_bids", "{oops")));
      expect(toolCallKeyOf(toolCall("a", "get_bids", "{oops"))).not.toBe(toolCallKeyOf(toolCall("b", "get_bids", "{oops!")));
    });
  });

  describe(toolCallsOfCurrentTurn.name, () => {
    it("pairs the calls since the latest user message with their results", () => {
      const earlier = toolCall("c1", "get_bids", { dseq: "1" });
      const answered = toolCall("c2", "get_deployment", { dseq: "1" });
      const pending = toolCall("c3", "read_logs", { dseq: "1" });
      const messages: ChatMessage[] = [
        { role: "user", content: "why?" },
        { role: "assistant", content: null, tool_calls: [earlier] },
        { role: "tool", tool_call_id: "c1", content: "bids" },
        { role: "user", content: "and now?" },
        { role: "assistant", content: "Checking." },
        { role: "assistant", content: null, tool_calls: [answered, pending] },
        { role: "tool", tool_call_id: "c2", content: "deployment" }
      ];

      expect(toolCallsOfCurrentTurn(messages)).toEqual([
        { call: answered, result: "deployment" },
        { call: pending, result: undefined }
      ]);
    });

    it("reads the whole list when there is no user message", () => {
      const call = toolCall("c1", "get_bids", { dseq: "1" });

      expect(
        toolCallsOfCurrentTurn([
          { role: "assistant", content: null, tool_calls: [call] },
          { role: "tool", tool_call_id: "c1", content: "bids" }
        ])
      ).toEqual([{ call, result: "bids" }]);
    });
  });

  describe(earlierResultOf.name, () => {
    it("returns the result of the same call made earlier in the turn", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "why?" },
        { role: "assistant", content: null, tool_calls: [toolCall("c1", "get_bids", { dseq: "1" }), toolCall("c2", "get_bids", { dseq: "2" })] },
        { role: "tool", tool_call_id: "c1", content: "bids of 1" },
        { role: "tool", tool_call_id: "c2", content: "bids of 2" }
      ];

      expect(earlierResultOf(toolCall("c3", "get_bids", { dseq: "2" }), messages)).toBe("bids of 2");
      expect(earlierResultOf(toolCall("c4", "get_bids", { dseq: "3" }), messages)).toBeUndefined();
    });

    it("ignores a call still waiting on its result", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "why?" },
        { role: "assistant", content: null, tool_calls: [toolCall("c1", "read_logs", { dseq: "1" })] }
      ];

      expect(earlierResultOf(toolCall("c2", "read_logs", { dseq: "1" }), messages)).toBeUndefined();
    });
  });
});
