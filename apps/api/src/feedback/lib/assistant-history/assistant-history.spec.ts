import { describe, expect, it } from "vitest";

import { MAX_ASSISTANT_HISTORY_MESSAGES } from "@src/feedback/http-schemas/assistant-conversation.schema";
import { REDACTED } from "@src/feedback/lib/redact-secrets/redact-secrets";
import { ACTION_RESULT_TOOL_NAME, historyFromClient, historyFromStored, MAX_HISTORY_LENGTH } from "./assistant-history";

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
